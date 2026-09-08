"use client";

import { OperatorShell, useOperatorStore } from "@/components/operator/operator-shell";
import { RetailVerificationScreen } from "@/components/retail-verification-screen";
import { ButtonLink } from "@/components/customer/ui";

export function ClerkVerify({ initialCode }: { initialCode?: string }) {
  const [storeId, setStoreId] = useOperatorStore();
  return (
    <OperatorShell title="Verify a customer" storeId={storeId} onStoreChange={setStoreId}>
      <div className="mb-5"><ButtonLink href="/verify/counter">Sell a Zik Pass at the till</ButtonLink></div>
      <RetailVerificationScreen key={storeId} initialCode={initialCode} storeId={storeId} />
    </OperatorShell>
  );
}
