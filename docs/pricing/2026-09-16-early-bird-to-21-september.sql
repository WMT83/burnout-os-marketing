-- Reopen the sa-2026 early bird to 21 September, and move the in-person
-- instalment plan to three payments of R2,990.
--
-- Project: kvsirypfqtnymooxicti (Burnout-OS)   Stripe: acct_1TOsrlIXh8NpOtrx
-- Pairs with: public/register.html on the same commit. Neither half works alone.
--
-- WHY THIS IS SQL AND NOT A FUNCTION DEPLOY
--
-- create-tour-checkout (deployed v18, source header says v19) carries no date
-- constant and no price ID. It reads:
--   * the window from tours.early_bird_until,
--   * the price from tours.metadata.stripe_products[<family>_<tier>],
--   * the family from the cohort (metadata.pricing_key === 'online').
-- It also resolves the tier entirely server-side and reads nothing the caller
-- nominates, so the page and the charge cannot be made to disagree by the
-- client. Moving the window is therefore a data change on the tours row, and
-- the function needs no edit.
--
-- THE TRAP THIS STATEMENT EXISTS TO CLOSE
--
-- Moving early_bird_until alone is NOT enough, and is worse than doing nothing.
-- Today (early_bird_until = 2026-08-31, so isEarlyBird is false) an in-person
-- instalment buyer falls through to the v19 open_instalment rate and is charged
-- R2,990 x 3 from individual_open_instalment. That rate is gated on
-- `!isEarlyBird`. The moment the window reopens it goes dormant, and the
-- in-person instalment resolves to individual_early_bird.price_instalment,
-- which is still the old five-payment price (price_1TkuHw..., R1,890 x 5 =
-- R9,450). The page would advertise R2,990 x 3 and Stripe would bill R1,890
-- five times.
--
-- So the window move and the price swap are one statement, not two.
--
-- WHAT EACH TIER RESOLVES TO AFTER THIS RUNS (window open, to 2026-09-21)
--
--   in person,  pay in full   individual_early_bird.price_full        R8,950 once
--   in person,  instalment    individual_early_bird.price_instalment  R2,990 x 3 = R8,970
--   online,     pay in full   online_early_bird.price_full            R5,950 once
--   online,     instalment    online_early_bird.price_instalment      R2,050 x 3 = R6,150
--   corporate,  per place     corporate_early_bird.price_full         R10,950 per place
--
-- All five match PRICES in public/register.html, and all five prices were read
-- back from Stripe as active before this was written.
--
-- SIDE EFFECTS, BOTH DELIBERATE
--
--  1. request-corporate-quote reads the same early_bird_until, so corporate
--     quotes drop from R12,950 to R10,950 per place until 22 September. That is
--     what register.html already shows for corporate while the window is open.
--  2. early_bird_extended (the grant-gated R8,950) and open_instalment (the
--     ungated R2,990 x 3) are both gated on `!isEarlyBird`, so both go dormant
--     for the duration and return on 22 September untouched. Nothing about
--     them needs changing, and nothing about them is lost.
--
-- AFTER 21 SEPTEMBER, one thing does not line up, and it is a decision rather
-- than a bug: open_instalment reawakens and serves in-person instalment buyers
-- R2,990 x 3, while register.html will show the standard plan at R3,650 x 3.
-- The buyer is charged less than the page quotes. Either disable
-- open_instalment when the window closes, or set the page's standard instalment
-- to R2,990. It needs a call before 22 September.
--
-- HOW TO RUN
--
-- One statement, so it is atomic. The WHERE clause pins the state it expects,
-- so a second run changes nothing and returns no rows rather than re-applying.
-- Run it at the same time the paired pull request is merged, not before.

update public.tours
set
  early_bird_until = date '2026-09-21',
  metadata = jsonb_set(
    jsonb_set(
      metadata,
      '{stripe_products,individual_early_bird,price_instalment}',
      jsonb_build_object(
        'id',           'price_1UFiOnIXh8NpOtrxMWQGkBhg',
        'count',        3,
        'amount_cents', 299000
      ),
      false
    ),
    '{offer_window}',
    -- Merged onto what is there, never assigned wholesale, so the audit keys
    -- already on the block (set_on, confirmed_on, confirmed_by_operator) survive.
    coalesce(metadata -> 'offer_window', '{}'::jsonb) || jsonb_build_object(
      'early_bird_ends_at', '2026-09-21T23:59:59+02:00',
      'reopened_on',        '2026-09-16',
      'reopened_note',      'Window moved from 2026-08-31. In-person instalment moved to 3 x R2,990 in the same statement.',
      'confirmed_against',  'burnoutos.co.za/register EARLY_BIRD_END = 2026-09-21'
    ),
    false
  )
where slug = 'sa-2026'
  and early_bird_until = date '2026-08-31'
  and metadata #>> '{stripe_products,individual_early_bird,price_instalment,id}'
      = 'price_1TkuHwIXh8NpOtrxmQvOnvTd'
returning
  slug,
  early_bird_until,
  metadata #> '{stripe_products,individual_early_bird}' as in_person_early_bird,
  metadata -> 'offer_window'                            as offer_window;


-- VERIFY (separate call; the MCP execute_sql tool returns only the last
-- statement's result, so run this on its own).
--
-- select
--   early_bird_until,
--   current_date <= early_bird_until                                            as window_open,
--   metadata #>> '{stripe_products,individual_early_bird,price_full,id}'        as in_person_full_id,
--   metadata #>> '{stripe_products,individual_early_bird,price_instalment,id}'  as in_person_inst_id,
--   metadata #>> '{stripe_products,individual_early_bird,price_instalment,count}' as in_person_inst_count,
--   metadata #>> '{stripe_products,online_early_bird,price_instalment,id}'      as online_inst_id
-- from public.tours
-- where slug = 'sa-2026';
--
-- Expect: 2026-09-21, true, price_1TRiwx..., price_1UFiOn..., 3, price_1U51b4...


-- ROLLBACK, if the window has to be pulled back before 21 September. Restores
-- the five-payment price with it, so the pair never separates.
--
-- update public.tours
-- set
--   early_bird_until = date '2026-08-31',
--   metadata = jsonb_set(
--     metadata,
--     '{stripe_products,individual_early_bird,price_instalment}',
--     jsonb_build_object(
--       'id',           'price_1TkuHwIXh8NpOtrxmQvOnvTd',
--       'count',        5,
--       'amount_cents', 189000
--     ),
--     false
--   )
-- where slug = 'sa-2026';
--
-- register.html must be reverted in the same move.
