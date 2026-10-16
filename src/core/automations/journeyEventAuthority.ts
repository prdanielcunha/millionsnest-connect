import { createHmac } from 'node:crypto';
import type { InternalAutomationEvent } from './eventJobs';

/** Machine proof only: no bearer, phone, task ID or pastoral content.
 * Fixed canonical HTTPS Hub, no redirects, timeout and no authority cache. */
export function createJourneyEventAuthority(input: {
  hubOrigin?: string; signingSecret?: string; fetchImpl?: typeof fetch; now?: () => number;
}) {
  return async (event: InternalAutomationEvent): Promise<boolean> => {
    if (event.sourceApp!=='nestjourney' || event.trigger!=='followup.due' ||
        !input.signingSecret || input.signingSecret.length<32 || input.signingSecret.length>4096) return false;
    let origin: URL;
    try {
      origin=new URL(input.hubOrigin??'');
      if (origin.origin!==input.hubOrigin || !['https://www.millionsnest.com','https://millionsnest.com'].includes(origin.origin)) return false;
    } catch { return false; }
    const timestamp=String((input.now??Date.now)()),raw=JSON.stringify(event);
    const signature=createHmac('sha256',input.signingSecret).update('nestjourney-authority\n'+timestamp+'\n'+raw).digest('hex');
    try {
      const response=await (input.fetchImpl??fetch)(origin.origin+'/api/ecosystem/connect/nestjourney/event-authority',{
        method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(2500),
        headers:{'Content-Type':'application/json','x-connect-timestamp':timestamp,'x-connect-signature':signature},body:raw,
      });
      if (!response.ok) return false;
      const proof=await response.json() as Record<string,unknown>;
      return !!proof && typeof proof==='object' && Object.keys(proof).length===1 && proof.authorized===true;
    } catch { return false; }
  };
}
