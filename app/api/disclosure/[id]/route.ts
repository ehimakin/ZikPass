import { getDisclosure } from '@/lib/server/disclosure-service';
import { disclosureResponse, disclosureFailure, limitDisclosureTraffic } from '@/lib/server/disclosure-http';
export async function GET(_request: Request, context: {params: Promise<{id:string}>}) { try { limitDisclosureTraffic(); return disclosureResponse(await getDisclosure((await context.params).id)); } catch(e) { return disclosureFailure(e); } }
