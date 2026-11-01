import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrivateKey, privateDecrypt, createDecipheriv, constants } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
vi.mock('server-only',()=>({}));
import { prepareMerchant, decryptAtMerchant } from '@/lib/demo-rp/merchant';
import { createDisclosure, approveDisclosure, redeemDisclosure, resetDisclosures, getDisclosure } from '@/lib/server/disclosure-service';
import { encryptDisclosure, parseRequest, selectFields, binding } from '@/lib/shared/disclosure';
import { getRuntimeDataDir } from '@/lib/server/runtime-paths';
import { getIssuerKeyMaterial } from '@/lib/server/issuer-keys';
import { generateKeyPair, signString } from '@/lib/shared/crypto/ed25519';
import { serializeCredentialPayload } from '@/lib/shared/credential-format';
import type { AgeCredential } from '@/lib/shared/types';
const field = {value:'Secret Test Person',provenance:'self_entered',updated_at:'2026-09-12T00:00:00Z'} as const;
const profile = {version:1,legal_name:field,delivery_address:{...field,value:'91 Private Lane, London, SW1A 1AA, UK'},email:{...field,value:'private@example.test'}} as const;
const create = () => createDisclosure({client_id:'harbour-demo',return_uri:'/retail-demo',state:crypto.randomUUID().replaceAll('-','')});
async function approved() {
  const r=await create();const keys=await generateKeyPair(); const issuer=await getIssuerKeyMaterial();
  const payload:AgeCredential={credential_id:crypto.randomUUID(),over18:true,issuer:'Zik Pass',issued_at:new Date().toISOString(),activates_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),assurance_level:'in_person_verified',issuance_channel:'physical',verification_method:'physical_id_check',subject_public_key:keys.publicKeyJwk};
  const presentation={credential:{payload,zignature:await signString(issuer.privateKeyJwk,serializeCredentialPayload(payload)),algorithm:'Ed25519'},challenge:r.challenge,holder_signature:await signString(keys.privateKeyJwk,r.challenge),holder_algorithm:'Ed25519',presented_at:new Date().toISOString()};
  const envelope=await encryptDisclosure(r,selectFields(r,['legal_name','delivery_address'],profile));
  const out=await approveDisclosure({request_id:r.request_id,state:r.state,nonce:r.nonce,envelope,presentation});
  return {r,envelope,input:{code:out.code,audience:r.audience,return_uri:r.return_uri,state:r.state,nonce:r.nonce,request_id:r.request_id,version:r.version,expires_at:r.expires_at}};
}
beforeAll(async()=>{process.env.ZIK_DISCLOSURE_V1='true';await prepareMerchant();});
beforeEach(async()=>{await resetDisclosures();});
describe('selective disclosure boundary',()=>{
  it('rejects surplus, unregistered destinations, invalid field selection and provenance',async()=>{
    await expect(createDisclosure({client_id:'evil',return_uri:'/retail-demo',state:'x'.repeat(32)})).rejects.toThrow();
    await expect(createDisclosure({client_id:'harbour-demo',return_uri:'https://evil.test',state:'x'.repeat(32)})).rejects.toThrow();
    await expect(createDisclosure({client_id:'harbour-demo',return_uri:'/retail-demo',state:'x'.repeat(32),public_key:{}})).rejects.toThrow();
    const r=await create();expect(()=>parseRequest({...r,extra:1})).toThrow();expect(()=>parseRequest({...r,fields:[...r.fields,r.fields[0]]})).toThrow();
    expect(()=>selectFields(r,['legal_name'],profile)).toThrow();expect(()=>selectFields(r,['legal_name','delivery_address','dob' as never],profile)).toThrow();
    expect(selectFields(r,['legal_name','delivery_address'],profile)).toEqual({legal_name:profile.legal_name,delivery_address:profile.delivery_address});
    await expect(encryptDisclosure(r,{legal_name:{...field,provenance:'zik_verified'},delivery_address:field})).rejects.toThrow();
  });
  it('interoperates with independent Node RSA-OAEP/AES-GCM and authenticates context',async()=>{
    const r=await create();const fields=selectFields(r,['legal_name','delivery_address'],profile);const e=await encryptDisclosure(r,fields);
    expect(await decryptAtMerchant(r,e)).toEqual(fields);
    const jwk=await prepareMerchant();const raw=privateDecrypt({key:createPrivateKey({key:jwk as import('node:crypto').JsonWebKey,format:'jwk'}),padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(e.wrapped_key,'base64url'));
    const bytes=Buffer.from(e.ciphertext,'base64url');const decipher=createDecipheriv('aes-256-gcm',raw,Buffer.from(e.iv,'base64url'));decipher.setAAD(binding(r));decipher.setAuthTag(bytes.subarray(-16));
    expect(JSON.parse(Buffer.concat([decipher.update(bytes.subarray(0,-16)),decipher.final()]).toString())).toEqual(fields);raw.fill(0);
    for(const patch of [{nonce:'other'},{state:'other'},{audience:'other'},{request_id:'other'},{version:2},{expires_at:r.expires_at+1}])await expect(decryptAtMerchant({...r,...patch} as typeof r,e)).rejects.toThrow();
  });
  it('binds every redemption field, consumes once under concurrency and stores no profile plaintext',async()=>{
    const {input}=await approved();
    const disk=await fs.readFile(path.join(getRuntimeDataDir(),'disclosures.json'),'utf8');for(const f of Object.values(profile).filter(v=>typeof v==='object'))expect(disk).not.toContain(f.value);
    for(const key of ['audience','return_uri','state','nonce','request_id','version','expires_at'])await expect(redeemDisclosure({...input,[key]:'wrong'})).rejects.toThrow();
    const results=await Promise.allSettled([redeemDisclosure(input),redeemDisclosure(input)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    await expect(redeemDisclosure(input)).rejects.toThrow();
    const success=results.find(r=>r.status==='fulfilled');if(success?.status==='fulfilled'){const text=JSON.stringify(success.value.age);expect(text).not.toMatch(/credential_id|subject_public_key|zignature|date_of_birth/);}
    expect(await fs.readFile(path.join(getRuntimeDataDir(),'disclosures.json'),'utf8')).not.toContain('ciphertext');
  });
  it('expires and fails closed with feature flag disabled',async()=>{
    const {r,input}=await approved();vi.spyOn(Date,'now').mockReturnValue(r.expires_at+1);
    await expect(redeemDisclosure(input)).rejects.toThrow();vi.restoreAllMocks();
    process.env.ZIK_DISCLOSURE_V1='false';await expect(create()).rejects.toThrow();await expect(getDisclosure(r.request_id)).rejects.toThrow();await expect(redeemDisclosure(input)).rejects.toThrow();process.env.ZIK_DISCLOSURE_V1='true';
  });
});
