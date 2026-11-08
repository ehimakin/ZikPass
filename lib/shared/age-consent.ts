/** Age consent metadata contains no profile vocabulary, key or Vault dependency. */
export interface AgeConsentV1 { version:1; request_id:string; audience:string; display_name:string; return_uri:string; state:string; nonce:string; issued_at:string; expires_at:string; threshold:18; purpose:string; fields:['age_over_18'] }
export function parseAgeConsent(value:unknown):AgeConsentV1 {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('invalid_age_consent');
  const r=value as Record<string,unknown>;const keys=['version','request_id','audience','display_name','return_uri','state','nonce','issued_at','expires_at','threshold','purpose','fields'];
  if(Object.keys(r).length!==keys.length||keys.some(k=>!(k in r))||r.version!==1||r.threshold!==18||!Array.isArray(r.fields)||r.fields.length!==1||r.fields[0]!=='age_over_18')throw Error('invalid_age_consent');
  for(const k of keys.filter(k=>!['version','threshold','fields'].includes(k)))if(typeof r[k]!=='string'||!(r[k] as string).trim()||(r[k] as string).length>2048)throw Error('invalid_age_consent');
  if(!Number.isFinite(Date.parse(r.issued_at as string))||!Number.isFinite(Date.parse(r.expires_at as string)))throw Error('invalid_age_consent');
  return r as unknown as AgeConsentV1;
}
