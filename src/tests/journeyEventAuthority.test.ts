import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createJourneyEventAuthority } from '../core/automations/journeyEventAuthority';
import type { InternalAutomationEvent } from '../core/automations/eventJobs';
const secret='synthetic-journey-specific-key-more-than-32-chars',now=Date.now();
const event:InternalAutomationEvent={schemaVersion:1,sourceApp:'nestjourney',eventId:'a'.repeat(64),organizationId:'org-a',
  conversationId:'thread-a',occurredAt:new Date(now-1000).toISOString(),trigger:'followup.due',recipientUid:'operator-a'};
let calls=0;
const args={hubOrigin:'https://www.millionsnest.com',signingSecret:secret,now:()=>now,
  fetchImpl:async(url:unknown,init?:RequestInit)=>{
    calls++;assert.equal(String(url),'https://www.millionsnest.com/api/ecosystem/connect/nestjourney/event-authority');
    assert.equal(init?.redirect,'error');assert.equal(init?.cache,'no-store');assert(!('Authorization' in (init?.headers??{})));
    const raw=String(init?.body),headers=init?.headers as Record<string,string>;
    assert.equal(headers['x-connect-signature'],createHmac('sha256',secret)
      .update('nestjourney-authority\n'+headers['x-connect-timestamp']+'\n'+raw).digest('hex'));
    assert.deepEqual(JSON.parse(raw),event);
    return Response.json({authorized:true});
  }};
assert.equal(await createJourneyEventAuthority(args)(event),true);
assert.equal(await createJourneyEventAuthority(args)(event),true);assert.equal(calls,2,'authority is never cached');
for(const hubOrigin of ['http://www.millionsnest.com','https://www.millionsnest.com.evil.test','https://evil.test',undefined]){
  assert.equal(await createJourneyEventAuthority({...args,hubOrigin})(event),false);
}
assert.equal(calls,2,'unsafe/missing origin makes zero external requests');
for(const response of [Response.json({authorized:false}),Response.json({authorized:true,extra:'untrusted'}),
  new Response('{}',{status:401}),new Response('{}',{status:503}),new Response('not-json')]){
  assert.equal(await createJourneyEventAuthority({...args,fetchImpl:async()=>response})(event),false);
}
assert.equal(await createJourneyEventAuthority({...args,fetchImpl:async()=>{throw Error('synthetic-timeout');}})(event),false);
assert.equal(await createJourneyEventAuthority({...args,signingSecret:undefined})(event),false);
console.log('Journey queued-event authority PASS: fixed Hub origin, domain-separated HMAC, no caching, no bearer/PII, revocation/upstream failure denied. Synthetic transport.');
