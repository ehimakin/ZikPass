/** Explicit co-hosted DEMO relying party. Never import from lib/server or client modules. */
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getRuntimeDataDir } from '@/lib/server/runtime-paths';
import { binding, parseEnvelope, parseReleased, type DisclosureRequestV1 } from '@/lib/shared/disclosure';
import { decode } from '@/lib/shared/vault';
let keyPromise: Promise<JsonWebKey> | undefined;
export function prepareMerchant(): Promise<JsonWebKey> {
  return keyPromise ??= (async () => {
    const dir = getRuntimeDataDir(); await fs.mkdir(dir,{recursive:true});
    const file = path.join(dir,'demo-merchant-private.json');
    let privateKey: JsonWebKey;
    try { privateKey = JSON.parse(await fs.readFile(file,'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const pair = await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['wrapKey','unwrapKey']);
      privateKey = await crypto.subtle.exportKey('jwk',pair.privateKey);
      await fs.writeFile(file,JSON.stringify(privateKey),{mode:0o600,flag:'wx'});
    }
    const publicKey = {kty:'RSA',n:privateKey.n,e:privateKey.e,alg:'RSA-OAEP-256',ext:true,key_ops:['wrapKey']};
    await fs.writeFile(path.join(dir,'demo-merchant-public.json'),JSON.stringify(publicKey));
    return privateKey;
  })();
}
export async function decryptAtMerchant(request: DisclosureRequestV1, input: unknown) {
  const envelope = parseEnvelope(input);
  const privateKey = await crypto.subtle.importKey('jwk',await prepareMerchant(),{name:'RSA-OAEP',hash:'SHA-256'},false,['unwrapKey']);
  const key = await crypto.subtle.unwrapKey('raw',decode(envelope.wrapped_key,256,512),privateKey,'RSA-OAEP',{name:'AES-GCM',length:256},false,['decrypt']);
  const bytes = new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(envelope.iv,12),additionalData:binding(request),tagLength:128},key,decode(envelope.ciphertext,16,8192)));
  try { return parseReleased(JSON.parse(new TextDecoder().decode(bytes)),request); } finally { bytes.fill(0); }
}
