import { approveDisclosure } from '@/lib/server/disclosure-service';
import { readDisclosureBody, disclosureResponse, disclosureFailure } from '@/lib/server/disclosure-http';
export async function POST(request: Request) { try { return disclosureResponse(await approveDisclosure(await readDisclosureBody(request))); } catch(e) { return disclosureFailure(e); } }
