import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer/customer-shell";
import { WalletScreen } from "@/components/customer/wallet-screen";
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

  // Legacy physical handoff link still resolves through WalletSurface.
  if (physicalEntry) {
    return (
      <main>
        <Suspense fallback={null}>
          <WalletSurface />
        </Suspense>
      </main>
    );
  }

  // Preserve installed-app and device handoffs on the pass claim screen.
  const handoffToken = getParam(params.handoff_token);
  const fromPwa = getParam(params.source) === "pwa";
  if (handoffToken || fromPwa) {
    const q = new URLSearchParams({ source: "pwa" });
    if (handoffToken) q.set("handoff_token", handoffToken);
    redirect(`/pass?${q.toString()}`);
  }
  return <CustomerShell active="wallet"><WalletScreen /></CustomerShell>;
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
