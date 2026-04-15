import { ZikHostedVerification } from "@/components/zik-hosted-verification";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";
import type { VendorVerificationSession } from "@/lib/shared/vendor-verification";

export default async function ZikHostedVerificationPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [issuerPublicKey, params] = await Promise.all([getIssuerPublicKey(), searchParams]);

  const session: VendorVerificationSession = {
    session_id: getParam(params.session) ?? "unknown-session",
    vendor_name: getParam(params.vendor) ?? "Vendor",
    vendor_origin: getParam(params.origin) ?? "http://localhost:3000",
    request: "over18"
  };

  return <ZikHostedVerification issuerPublicKey={issuerPublicKey} session={session} />;
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
