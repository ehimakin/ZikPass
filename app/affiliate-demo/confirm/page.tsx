import { AffiliateConfirmScreen } from "@/components/affiliate-confirm-screen";

export default async function AffiliateConfirmPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestId = getParam(params.request_id) ?? "";

  return <AffiliateConfirmScreen requestId={requestId} />;
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
