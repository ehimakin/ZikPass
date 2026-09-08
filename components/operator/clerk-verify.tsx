"use client";

import { OperatorShell, useOperatorStore } from "@/components/operator/operator-shell";
import { RetailVerificationScreen } from "@/components/retail-verification-screen";

export function ClerkVerify({ initialCode }: { initialCode?: string }) {
  const [storeId, setStoreId] = useOperatorStore();
  return (
    <OperatorShell title="Verify a customer" storeId={storeId} onStoreChange={setStoreId}>
      <RetailVerificationScreen key={storeId} initialCode={initialCode} storeId={storeId} />
    </OperatorShell>
  );
}
