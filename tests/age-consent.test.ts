import {expect,it} from 'vitest';
import {parseAgeConsent} from '@/lib/shared/age-consent';
it('allows only an age field with exact v1 metadata',()=>{
 const r={version:1,request_id:'r',audience:'a',display_name:'Site',return_uri:'/callback',state:'s',nonce:'n',issued_at:'2026-09-12T00:00:00Z',expires_at:'2026-09-12T00:02:00Z',threshold:18,purpose:'Age check',fields:['age_over_18']};
 expect(parseAgeConsent(r)).toEqual(r);
 for(const patch of [{fields:['age_over_18','legal_name']},{version:2},{profile:{}},{fields:['age_over_18','age_over_18']}])expect(()=>parseAgeConsent({...r,...patch})).toThrow();
});
