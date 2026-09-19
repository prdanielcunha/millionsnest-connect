import {
  createNestJourneyFollowupContextHttpHandler,
} from '../core/runtime/nestJourneyFollowupContextHttpHandler';
import type { CanonicalContextProvider, CanonicalContextResolution } from '../core/runtime/connectCore';

let passed = 0;
function equal(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  passed++;
}
function provider(result: CanonicalContextResolution): CanonicalContextProvider {
  return { async resolve() { return result; } };
}
function resolved(org='org1'): CanonicalContextResolution {
  return {
    status:'resolved',
    context:{
      actorUid:'user1',systemRole:null,globalAccess:false,organizationId:org,organizationRole:'care',
      permissions:[],capabilities:[],appAccess:{musicscale:false,nestlocal:false},
    },
  };
}
function req(query:any={}, authorization='Bearer firebase-token') {
  return { headers:{authorization}, query } as any;
}
function res() {
  const state:any={statusCode:200,body:null,headers:{}};
  state.setHeader=(k:string,v:string)=>{state.headers[k.toLowerCase()]=v;return state;};
  state.status=(code:number)=>{state.statusCode=code;return state;};
  state.json=(body:unknown)=>{state.body=body;return state;};
  return state;
}
const payload={
  success:true,
  organization:{id:'org1',name:'OBPC'},
  followup:{id:'first-contact-care1',careRequestId:'care1',congregationId:'camp1',dueAt:'2026-09-19T12:00:00.000Z'},
  person:{name:'João da Silva',phone:'5543999999999'},
  returnTo:'https://nestjourney.millionsnest.com/followup-runtime?followup=first-contact-care1',
};

{
  const response=res();
  const handler=createNestJourneyFollowupContextHttpHandler({contextProvider:provider(resolved()),hubOrigin:'https://www.millionsnest.com'});
  await handler(req({organizationId:'org1',followupId:'first-contact-care1'},''),response);
  equal(response.statusCode,401,'missing bearer blocked');
}
{
  const response=res();
  const handler=createNestJourneyFollowupContextHttpHandler({contextProvider:provider(resolved('org2')),hubOrigin:'https://www.millionsnest.com'});
  await handler(req({organizationId:'org1',followupId:'first-contact-care1'}),response);
  equal(response.statusCode,409,'tenant mismatch blocked');
}
{
  let upstreamUrl='';
  let upstreamAuth='';
  const response=res();
  const handler=createNestJourneyFollowupContextHttpHandler({
    contextProvider:provider(resolved()),
    hubOrigin:'https://www.millionsnest.com',
    fetchImpl:async(input:any,init:any)=>{
      upstreamUrl=String(input); upstreamAuth=String(init?.headers?.Authorization||'');
      return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
    },
  });
  await handler(req({organizationId:'org1',followupId:'first-contact-care1'}),response);
  equal(response.statusCode,200,'valid context returned');
  equal(upstreamAuth,'Bearer firebase-token','bearer forwarded transiently');
  equal(new URL(upstreamUrl).searchParams.get('followupId'),'first-contact-care1','followup pinned upstream');
  equal(response.body.person.phone,'5543999999999','minimal phone returned to authenticated client');
  equal(response.headers['cache-control'],'no-store','response is not cacheable');
}
{
  const response=res();
  const handler=createNestJourneyFollowupContextHttpHandler({
    contextProvider:provider(resolved()),hubOrigin:'https://www.millionsnest.com',
    fetchImpl:async()=>new Response(JSON.stringify({success:false,code:'FOLLOWUP_SCOPE_DENIED'}),{status:403,headers:{'Content-Type':'application/json'}}),
  });
  await handler(req({organizationId:'org1',followupId:'first-contact-care1'}),response);
  equal(response.statusCode,403,'upstream scope denial preserved');
  equal(response.body.code,'FOLLOWUP_SCOPE_DENIED','upstream safe code preserved');
}
{
  const response=res();
  const bad={...payload,returnTo:'https://evil.example/followup-runtime?followup=first-contact-care1'};
  const handler=createNestJourneyFollowupContextHttpHandler({
    contextProvider:provider(resolved()),hubOrigin:'https://www.millionsnest.com',
    fetchImpl:async()=>new Response(JSON.stringify(bad),{status:200,headers:{'Content-Type':'application/json'}}),
  });
  await handler(req({organizationId:'org1',followupId:'first-contact-care1'}),response);
  equal(response.statusCode,502,'unsafe return URL rejected');
}
{
  const response=res();
  const handler=createNestJourneyFollowupContextHttpHandler({contextProvider:provider(resolved()),hubOrigin:'https://www.millionsnest.com'});
  await handler(req({organizationId:'org1',followupId:'../care1'}),response);
  equal(response.statusCode,400,'path-like followup id rejected');
}

console.log(`NestJourney follow-up proxy: ${passed} checks passed.`);
