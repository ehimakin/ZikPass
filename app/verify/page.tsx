import { AppShell } from "@/components/app-shell";
import { RetailVerificationScreen } from "@/components/retail-verification-screen";

export default async function VerifyPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <AppShell currentPath="/verify">
      <RetailVerificationScreen initialCode={getParam(params.code)} />
    </AppShell>
  );
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
