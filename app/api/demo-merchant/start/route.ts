import { prepareMerchant } from '@/lib/demo-rp/merchant';
import { createDisclosure, requireDisclosureEnabled } from '@/lib/server/disclosure-service';
import { readDisclosureBody, disclosureResponse, disclosureFailure } from '@/lib/server/disclosure-http';
import { strictObject, encode } from '@/lib/shared/vault';
export async function POST(request: Request) {
  try {
    requireDisclosureEnabled(); strictObject(await readDisclosureBody(request),[]); await prepareMerchant();
    const state = encode(crypto.getRandomValues(new Uint8Array(32)));
    const r = await createDisclosure({client_id:'harbour-demo',return_uri:'/retail-demo',state});
    const response = disclosureResponse(r);
    response.cookies.set('zik-retail-pending',JSON.stringify({request_id:r.request_id,state:r.state,nonce:r.nonce,expires_at:r.expires_at}),{httpOnly:true,sameSite:'strict',secure:new URL(request.url).protocol==='https:',path:'/api/demo-merchant',maxAge:120});
    return response;
  } catch(e) { return disclosureFailure(e); }
}
