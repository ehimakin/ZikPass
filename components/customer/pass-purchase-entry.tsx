"use client";

import { useSearchParams } from "next/navigation";
import type { Route } from "next";
import { OnboardingFlow } from "@/components/customer/onboarding/onboarding-flow";
import { PurchaseActivation } from "@/components/customer/purchase-activation";
import { ButtonLink } from "@/components/customer/ui";
import type { PassPrice } from "@/lib/shared/payment-config";

/** Card QR links can select the retail journey without implying payment or activation. */
export function PassPurchaseEntry({ price }: { price: PassPrice }) {
  const params = useSearchParams();
  const isCard = params.get("product") === "card" || params.get("entry_mode") === "retail_card";
  function href(product: "card" | "digital"): Route {
    const next = new URLSearchParams(params.toString());
    next.set("product", product);
    next.delete("entry_mode");
    return `/get-pass?${next.toString()}` as Route;
  }
  return (
    <div className="space-y-6">
      <p className="pt-5 text-sm text-[var(--zk-text-soft)]">Digital Zik Pass · 99p one-off, free during Early Access. Get verified in person.</p>
      <nav aria-label="Choose your pass product" className="grid grid-cols-2 gap-3">
        <ButtonLink href={href("digital")} variant={isCard ? "secondary" : "primary"}>Digital Zik Pass</ButtonLink>
        <ButtonLink href={href("card")} variant={isCard ? "primary" : "secondary"}>Physical Zik Card</ButtonLink>
      </nav>
      {isCard ? <PurchaseActivation price={price} storeId={params.get("store_id") ?? undefined} /> : <OnboardingFlow price={price} />}
    </div>
  );
}
