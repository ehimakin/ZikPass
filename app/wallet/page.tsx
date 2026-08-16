import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { WalletPageSurface } from "@/components/wallet-page-surface";
import { WalletSurface } from "@/components/wallet-surface";

export default async function WalletPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const physicalEntry =
    getParam(params.flow) === "physical" ||
    Boolean(getParam(params.session_id)) ||
    Boolean(getParam(params.store_id));

  if (physicalEntry) {
    return (
      <main>
        <Suspense fallback={null}>
          <WalletSurface />
        </Suspense>
      </main>
    );
  }

  return (
    <AppShell currentPath="/wallet">
      <WalletPageSurface />
    </AppShell>
  );
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
