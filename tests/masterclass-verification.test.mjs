import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/verify-masterclass.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function page(result={status:'registered',confirmation_message:'Access email sent.'},ok=true,hash='#token=11111111-1111-4111-8111-111111111111.'+'a'.repeat(64)) {
  const elements=Object.fromEntries(['title','message','verify','next'].map(id=>[id,{hidden:id==='next',disabled:false,textContent:'',addEventListener(_event,cb){this.click=cb;}}]));
  let calls=0,body,cleared=false;
  vm.runInNewContext(source,{URLSearchParams,location:{hash,pathname:'/verify-masterclass.html'},history:{replaceState(){cleared=true;}},document:{getElementById(id){return elements[id];}},fetch:async(_url,options)=>{calls++;body=JSON.parse(options.body);return {ok,json:async()=>result};},Error});
  return {elements,get calls(){return calls;},get body(){return body;},cleared};
}
test('opening confirmation link does not provision; deliberate click confirms and shows success',async()=>{
  const p=page();assert.equal(p.calls,0);assert.ok(p.cleared);
  await p.elements.verify.click();assert.equal(p.calls,1);assert.equal(p.body.action,'confirm');
  assert.equal(p.elements.title.textContent,'Your email is verified');assert.equal(p.elements.message.textContent,'Access email sent.');assert.ok(p.elements.verify.hidden);
});
test('invalid or expired links offer registration instead of a dead button',async()=>{
  const missing=page(undefined,true,'');assert.equal(missing.calls,0);assert.ok(missing.elements.verify.hidden);assert.equal(missing.elements.next.hidden,false);
  const expired=page({status:'error',code:'invalid_or_expired_link',message:'Expired'},false);
  await expired.elements.verify.click();assert.ok(expired.elements.verify.hidden);assert.equal(expired.elements.next.hidden,false);
});
test('terminal provisioning error offers a new link and processing state offers support',async()=>{
  for(const code of ['registration_failed','registration_processing']){
    const p=page({status:'error',code,message:'Recovery instructions'},false);await p.elements.verify.click();
    assert.ok(p.elements.verify.hidden);assert.equal(p.elements.next.hidden,code==='registration_processing');assert.equal(p.elements.message.textContent,'Recovery instructions');
  }
});
test('temporary service error allows retry without reloading the token-bearing URL',async()=>{
  const p=page({status:'error',code:'verification_unavailable',message:'Try later'},false);await p.elements.verify.click();
  assert.equal(p.elements.verify.disabled,false);assert.equal(p.elements.verify.textContent,'Try again');assert.equal(p.elements.message.textContent,'Try later');
});
