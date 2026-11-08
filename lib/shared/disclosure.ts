import { boundedString, decode, encode, PROFILE_FIELDS, selfEntered, strictObject, utf8, type ProfileField, type SelfEntered, type VaultProfileV1 } from './vault';
export type DisclosureField = ProfileField | 'age_over_18';
export type DisclosureRequestV1 = { version: 1; request_id: string; audience: string; display_name: string; return_uri: string; state: string; nonce: string; issued_at: number; expires_at: number; purpose: string; threshold: 18; fields: { field: DisclosureField; required: boolean }[]; public_key: JsonWebKey; challenge: string };
export type DisclosureEnvelopeV1 = { version: 1; iv: string; wrapped_key: string; ciphertext: string };
export function parseRequest(value: unknown): DisclosureRequestV1 {
  const r = strictObject(value, ['version','request_id','audience','display_name','return_uri','state','nonce','issued_at','expires_at','purpose','threshold','fields','public_key','challenge']);
  if (r.version !== 1 || r.threshold !== 18 || typeof r.issued_at !== 'number' || typeof r.expires_at !== 'number' || !Number.isFinite(r.issued_at) || !Number.isFinite(r.expires_at) || r.expires_at - r.issued_at > 120000 || r.expires_at <= r.issued_at) throw Error('invalid_request');
  for (const k of ['request_id','audience','display_name','return_uri','state','nonce','purpose','challenge']) boundedString(r[k], 2048);
  if (!Array.isArray(r.fields) || r.fields.length < 1 || r.fields.length > 4) throw Error('invalid_fields');
  const seen = new Set();
  for (const f of r.fields) { const x = strictObject(f, ['field','required']); if (![...PROFILE_FIELDS, 'age_over_18'].includes(x.field as DisclosureField) || typeof x.required !== 'boolean' || seen.has(x.field)) throw Error('invalid_fields'); seen.add(x.field); }
  if (!r.fields.some(f => f.field === 'age_over_18' && f.required)) throw Error('invalid_fields');
  const key = strictObject(r.public_key, ['kty','n','e'], ['alg','ext','key_ops']);
  if (key.kty !== 'RSA' || key.e !== 'AQAB') throw Error('invalid_key'); decode(key.n, 256, 512);
  return r as DisclosureRequestV1;
}
export function binding(r: DisclosureRequestV1): Uint8Array<ArrayBuffer> {
  return utf8(JSON.stringify(['zik-disclosure', r.version, r.request_id, r.audience, r.return_uri, r.state, r.nonce, r.expires_at]));
}
export function parseEnvelope(value: unknown): DisclosureEnvelopeV1 {
  const r = strictObject(value, ['version','iv','wrapped_key','ciphertext']);
  if (r.version !== 1) throw Error('unsupported_version'); decode(r.iv,12); decode(r.wrapped_key,256,512); decode(r.ciphertext,16,8192);
  return r as DisclosureEnvelopeV1;
}
export function selectFields(r: DisclosureRequestV1, selected: ProfileField[], profile: VaultProfileV1): Partial<Record<ProfileField, SelfEntered>> {
  if (new Set(selected).size !== selected.length || selected.some(f => !r.fields.some(x => x.field === f))) throw Error('invalid_selection');
  const output: Partial<Record<ProfileField, SelfEntered>> = {};
  for (const f of r.fields) {
    if (f.field === 'age_over_18') continue;
    if (f.required && !selected.includes(f.field)) throw Error('required_field');
    if (selected.includes(f.field)) output[f.field] = selfEntered(profile[f.field]);
  }
  return output;
}
export function parseReleased(value: unknown, r: DisclosureRequestV1): Partial<Record<ProfileField, SelfEntered>> {
  const required = r.fields.filter(f => f.required && f.field !== 'age_over_18').map(f => f.field);
  const optional = r.fields.filter(f => !f.required && f.field !== 'age_over_18').map(f => f.field);
  const fields = strictObject(value, required, optional);
  return Object.fromEntries(Object.entries(fields).map(([key,v]) => [key,selfEntered(v)]));
}
export async function encryptDisclosure(r: DisclosureRequestV1, fields: unknown): Promise<DisclosureEnvelopeV1> {
  parseRequest(r);
  const plain = utf8(JSON.stringify(parseReleased(fields, r)));
  const key = await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
  const merchant = await crypto.subtle.importKey('jwk',r.public_key,{name:'RSA-OAEP',hash:'SHA-256'},false,['wrapKey']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try { return {version:1, iv:encode(iv), wrapped_key:encode(new Uint8Array(await crypto.subtle.wrapKey('raw',key,merchant,'RSA-OAEP'))), ciphertext:encode(new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:binding(r),tagLength:128},key,plain)))}; }
  finally { plain.fill(0); }
}
