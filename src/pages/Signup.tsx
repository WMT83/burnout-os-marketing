import { useState } from 'react';
import { supabase } from '../lib/supabase';

// Signup handoff architecture:
// 1. Create Supabase user on www.burnout-os.app
// 2. Hand off session to app.burnout-os.app via /auth?access_token=...&next=...
// 3. Platform establishes session, then forwards to /pricing?auto_checkout=<tier>
// 4. Platform's Pricing page auto-invokes create-payment-intent which sets full
//    product metadata for the webhook, which notifies MarketOS.
//
// This replaces the previous Payment Link flow (deprecated April 2026) which
// could not carry product metadata and therefore misrouted MarketOS leads.

const REGION_OPTIONS = [
  { value: 'au', label: 'Australia' },
  { value: 'za', label: 'South Africa' },
  { value: 'gb', label: 'United Kingdom' },
];

const TIER_OPTIONS = [
  { value: 'self_guided', label: 'Self-Guided — AUD $697 / ZAR R7,997 / GBP £397' },
  { value: 'intensive', label: 'Burnout Recovery Intensive — AUD 2,997 / ZAR R24,950 / GBP £847' },
];

export default function Signup() {
  // Read pre-selected tier/region from URL params (e.g. from intensive.html)
  const params = new URLSearchParams(window.location.search);
  const defaultTier = params.get('tier') === 'intensive' ? 'intensive' : 'self_guided';
  const defaultRegion = ['au', 'za', 'gb'].includes(params.get('region') ?? '') ? params.get('region')! : 'au';

  const [step, setStep]         = useState<'details' | 'processing'>('details');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [region, setRegion]     = useState(defaultRegion);
  const [tier, setTier]         = useState(defaultTier);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create Supabase account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authError) throw authError;
      if (!authData.user) throw new Error('Signup failed — please try again.');

      // Session handoff: www.burnout-os.app → app.burnout-os.app
      // Subdomains don't share cookies. We establish session on the app domain
      // via /auth?access_token=... then forward to the platform's Pricing page,
      // which auto-invokes checkout using create-payment-intent (sets full
      // product metadata for the webhook and MarketOS integration).
      const session = authData.session;
      if (!session) {
        throw new Error('We could not sign you in. For the October clinician Burnout Reset, use the activation link above. Otherwise, sign in below or check your email for a confirmation link.');
      }

      // Map region code to Stripe-config region key.
      // Signup uses 'au' / 'za' / 'gb'; Stripe config uses 'aud' / 'zar' / 'gbp'.
      const regionToCurrency: Record<string, string> = { au: 'aud', za: 'zar', gb: 'gbp' };
      const currencyRegion = regionToCurrency[region] ?? 'aud';
      const pricingPath = `/pricing?auto_checkout=${tier}&region=${currencyRegion}`;
      const handoffUrl = `https://app.burnout-os.app/auth?access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=signup&next=${encodeURIComponent(pricingPath)}`;

      setStep('processing');
      setTimeout(() => {
        window.location.href = handoffUrl;
      }, 400);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      if (message.toLowerCase().includes('already registered') || message.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists. For the October clinician Burnout Reset, use the activation link above. Otherwise, sign in below.');
      } else {
        setError(message);
      }
      setLoading(false);
    }
  }

  if (step === 'processing') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 24px' }} />
          <div className="auth-title" style={{ fontSize: '22px' }}>Redirecting to secure checkout…</div>
          <div className="auth-sub">You'll be back in moments to start your recovery.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">BurnoutOS</div>
        <section className="auth-reset-access" aria-label="October clinician Burnout Reset access">
          <strong>Joining the October clinician Burnout Reset?</strong>
          <p>Your BurnoutOS access is included with your registration. Activate it with your booking email; there is no additional payment.</p>
          <a href="https://app.burnout-os.app/tour/activate">Activate your included access →</a>
        </section>
        <div className="auth-title">Start your recovery</div>
        <div className="auth-sub">8-week evidence-based programme. One-time payment. Ongoing access.</div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSignup} autoComplete="on">
          <div className="auth-field">
            <label>FULL NAME</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </div>
          <div className="auth-field">
            <label>EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="auth-field">
            <label>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="auth-field">
            <label>PROGRAMME</label>
            <select value={tier} onChange={e => setTier(e.target.value)}>
              {TIER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="auth-field">
            <label>REGION</label>
            <select value={region} onChange={e => setRegion(e.target.value)}>
              {REGION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Continue to payment →'}
          </button>
        </form>

        <div style={{ margin: '20px 0', background: 'var(--surface-2)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            ✓ Immediate access upon payment<br />
            ✓ 30-day satisfaction commitment<br />
            ✓ Secure payment via Stripe
          </div>
        </div>

        <div className="auth-link">
          Already have an account?{' '}
          <a href="https://app.burnout-os.app/auth">Sign in →</a>
        </div>
      </div>
    </div>
  );
}
