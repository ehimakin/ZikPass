import { cancelDisclosure } from '@/lib/server/disclosure-service';
import { readDisclosureBody, disclosureResponse, disclosureFailure } from '@/lib/server/disclosure-http';
export async function POST(request: Request) { try { await cancelDisclosure(await readDisclosureBody(request)); return disclosureResponse({ok:true}); } catch(e) { return disclosureFailure(e); } }
