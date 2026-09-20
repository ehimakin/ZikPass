"use client";

import { OperatorShell } from "@/components/operator/operator-shell";
import { RetailVerificationScreen } from "@/components/retail-verification-screen";
import { ButtonLink } from "@/components/customer/ui";

export function ClerkVerify({ initialCode, storeId, cardDemo = false }: { initialCode?: string; storeId: string; cardDemo?: boolean }) {
  return (
    <OperatorShell title="Verify a customer" storeId={storeId}>
      <div className="mb-5"><ButtonLink href="/verify/purchase">Sell a Zik Pass at the till</ButtonLink></div>
      {cardDemo ? <div className="mb-5"><ButtonLink href="/verify/card">Activate Zik Card</ButtonLink></div> : null}
      <RetailVerificationScreen key={storeId} initialCode={initialCode} storeId={storeId} />
    </OperatorShell>
  );
}
