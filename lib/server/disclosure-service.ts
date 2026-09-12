import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { getRuntimeDataDir } from './runtime-paths';
import { createAffiliateAuthorizationRequest, completeAffiliateChallenge, exchangeAffiliateAuthorizationCode } from './affiliate-verifier';
import { parseEnvelope, parseRequest, type DisclosureRequestV1, type DisclosureEnvelopeV1 } from '@/lib/shared/disclosure';
import { boundedString, strictObject } from '@/lib/shared/vault';
import type { AffiliateVerificationResult, PresentationBundle } from '@/lib/shared/types';
export const DISCLOSURE_DENIAL = 'This disclosure could not be completed. Please start again.';
export class DisclosureError extends Error { constructor(public readonly reason: 'disabled'|'invalid'|'expired'|'replay'|'binding'|'rate_limit'|'age_denied') { super(DISCLOSURE_DENIAL); } }
export function requireDisclosureEnabled() { if (process.env.ZIK_DISCLOSURE_V1 !== 'true') throw new DisclosureError('disabled'); }
type RecordV1 = { request: DisclosureRequestV1; status: 'pending'|'approved'|'consumed'|'cancelled'; envelope?: DisclosureEnvelopeV1; code_hash?: string; age?: AffiliateVerificationResult };
let queue: Promise<unknown> = Promise.resolve();
function transaction<T>(fn: (records: RecordV1[]) => Promise<T>): Promise<T> {
  const result = queue.then(async () => {
    const file = path.join(getRuntimeDataDir(),'disclosures.json');
    let records: RecordV1[];
    try { records = JSON.parse(await fs.readFile(file,'utf8')); }
    catch(error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; records = []; }
    // Do not persist expired ciphertext. Unknown store shapes fail closed.
    if (!Array.isArray(records)) throw new DisclosureError('invalid');
    records = records.filter(r => r.request.expires_at > Date.now());
    const value = await fn(records);
    await fs.mkdir(path.dirname(file),{recursive:true});
    const tmp = `${file}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp,JSON.stringify(records),{mode:0o600}); await fs.rename(tmp,file);
    return value;
  });
  queue = result.catch(() => undefined); return result;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function createDisclosure(value: unknown) {
  requireDisclosureEnabled();
  const input = strictObject(value,['client_id','return_uri','state']);
  if (input.client_id !== 'harbour-demo' || input.return_uri !== '/retail-demo') throw new DisclosureError('binding');
  const state = boundedString(input.state,128);
  if (!/^[a-zA-Z0-9_-]{32,128}$/.test(state)) throw new DisclosureError('invalid');
  return transaction(async records => {
    if (records.length >= 100) throw new DisclosureError('rate_limit');
    const age = await createAffiliateAuthorizationRequest({clientId:'harbour-demo',redirectUri:'/retail-demo',state});
    const publicKey = JSON.parse(await fs.readFile(path.join(getRuntimeDataDir(),'demo-merchant-public.json'),'utf8'));
    const now = Date.now();
    const request = parseRequest({version:1,request_id:age.request_id,audience:'harbour-demo',display_name:'Harbour & Pine',return_uri:'/retail-demo',state,nonce:age.nonce,issued_at:now,expires_at:Math.min(now+120000,Date.parse(age.challenge_expires_at)),purpose:'Confirm 18+ and fill your delivery details for this demo order.',threshold:18,fields:[{field:'age_over_18',required:true},{field:'legal_name',required:true},{field:'delivery_address',required:true},{field:'email',required:false}],public_key:publicKey,challenge:age.challenge});
    if (records.some(r => r.request.request_id === request.request_id)) throw new DisclosureError('replay');
    records.push({request,status:'pending'}); return request;
  });
}
export async function getDisclosure(id: string) {
  requireDisclosureEnabled(); boundedString(id,128);
  return transaction(async records => { const r = records.find(r => r.request.request_id === id); if (!r || r.status !== 'pending') throw new DisclosureError('expired'); return r.request; });
}
export function parsePresentation(value: unknown): PresentationBundle {
  const b = strictObject(value,['credential','challenge','holder_signature','holder_algorithm','presented_at']);
  const c = strictObject(b.credential,['payload','zignature','algorithm']);
  const p = strictObject(c.payload,['credential_id','over18','issuer','issued_at','activates_at','expires_at','assurance_level','issuance_channel','verification_method','subject_public_key'],['physical_attestation']);
  if (b.holder_algorithm !== 'Ed25519' || c.algorithm !== 'Ed25519' || p.over18 !== true || p.issuer !== 'Zik Pass' || p.assurance_level !== 'in_person_verified' || p.issuance_channel !== 'physical' || p.verification_method !== 'physical_id_check') throw new DisclosureError('invalid');
  for (const k of ['credential_id','issued_at','activates_at','expires_at']) boundedString(p[k]);
  for (const k of ['issued_at','activates_at','expires_at']) if (!Number.isFinite(Date.parse(p[k] as string))) throw new DisclosureError('invalid');
  const key = strictObject(p.subject_public_key,['kty','crv','x'],['ext','key_ops','alg']);
  if (key.kty !== 'OKP' || key.crv !== 'Ed25519') throw new DisclosureError('invalid');
  boundedString(key.x,64);
  if (p.physical_attestation !== undefined) { const a = strictObject(p.physical_attestation,['session_id','verification_method','verifier_id','retailer_id','location_id','verified_at']); for (const v of Object.values(a)) boundedString(v); }
  boundedString(c.zignature,256); boundedString(b.challenge,2048); boundedString(b.holder_signature,256); boundedString(b.presented_at,64);
  return b as unknown as PresentationBundle;
}
export async function approveDisclosure(value: unknown) {
  requireDisclosureEnabled();
  const input = strictObject(value,['request_id','state','nonce','envelope','presentation']);
  const envelope = parseEnvelope(input.envelope), presentation = parsePresentation(input.presentation);
  return transaction(async records => {
    const record = records.find(r => r.request.request_id === input.request_id);
    if (!record || record.status !== 'pending') throw new DisclosureError('replay');
    const r = record.request;
    if (r.state !== input.state || r.nonce !== input.nonce) throw new DisclosureError('binding');
    const outcome = await completeAffiliateChallenge({requestId:r.request_id,presentationBundle:presentation});
    if (outcome.outcome !== 'approved') throw new DisclosureError('age_denied');
    const age = await exchangeAffiliateAuthorizationCode({code:outcome.code,clientId:r.audience,redirectUri:r.return_uri,state:r.state});
    const code = randomBytes(32).toString('base64url');
    record.status = 'approved'; record.envelope = envelope; record.age = age; record.code_hash = hash(code);
    return {code,state:r.state,return_uri:r.return_uri};
  });
}
export async function redeemDisclosure(value: unknown) {
  requireDisclosureEnabled();
  const input = strictObject(value,['code','audience','return_uri','state','nonce','request_id','version','expires_at']);
  const codeHash = hash(boundedString(input.code,128));
  return transaction(async records => {
    const record = records.find(r => r.code_hash === codeHash);
    if (!record || record.status !== 'approved') throw new DisclosureError('replay');
    const r = record.request;
    for (const k of ['audience','return_uri','state','nonce','request_id','version','expires_at'] as const) if (input[k] !== r[k]) throw new DisclosureError('binding');
    if (r.expires_at <= Date.now()) throw new DisclosureError('expired');
    if (!record.envelope || !record.age) throw new DisclosureError('invalid');
    const result = {request:r,envelope:record.envelope,age:record.age};
    record.status = 'consumed'; delete record.envelope; delete record.age; delete record.code_hash;
    return result;
  });
}
export async function cancelDisclosure(value: unknown) {
  requireDisclosureEnabled(); const input = strictObject(value,['request_id','state']);
  await transaction(async records => { const r = records.find(r => r.request.request_id === input.request_id && r.request.state === input.state); if (!r || r.status !== 'pending') throw new DisclosureError('invalid'); r.status = 'cancelled'; });
}
export async function resetDisclosures() { await transaction(async records => { records.length = 0; }); }
