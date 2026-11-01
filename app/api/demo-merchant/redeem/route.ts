import { NextRequest } from 'next/server';
import { decryptAtMerchant } from '@/lib/demo-rp/merchant';
import { redeemDisclosure } from '@/lib/server/disclosure-service';
import { readDisclosureBody, disclosureResponse, disclosureFailure } from '@/lib/server/disclosure-http';
import { strictObject } from '@/lib/shared/vault';
export async function POST(request: NextRequest) {
  try {
    const body = strictObject(await readDisclosureBody(request),['code']);
    const pending = strictObject(JSON.parse(request.cookies.get('zik-retail-pending')?.value ?? 'null'),['request_id','state','nonce','expires_at']);
    const result = await redeemDisclosure({...pending,code:body.code,audience:'harbour-demo',return_uri:'/retail-demo',version:1});
    const fields = await decryptAtMerchant(result.request,result.envelope);
    const response = disclosureResponse({age:{age_over_18:true,provenance:'zik_verified'},fields});
    response.cookies.set('zik-retail-pending','',{path:'/api/demo-merchant',maxAge:0});
    return response;
  } catch(e) { return disclosureFailure(e); }
}
