import { ZikIdVerifier } from "@/components/zik-id-verifier";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";

export default async function ZikIdVerifierPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <ZikIdVerifier sessionId={value(params.session)} code={value(params.code)} issuerPublicKey={await getIssuerPublicKey()} />;
}

function value(input: string | string[] | undefined): string { return Array.isArray(input) ? input[0] ?? "" : input ?? ""; }
