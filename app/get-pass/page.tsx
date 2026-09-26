import { Suspense } from "react";
import type { Route } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { PassPurchaseEntry } from "@/components/customer/pass-purchase-entry";
import { getPassPrice } from "@/lib/shared/payment-config";

export default function GetPassPage() {
  return (
    <CustomerShell active="wallet" back={{ href: "/home" as Route, label: "Home" }}>
      <Suspense fallback={null}>
        <PassPurchaseEntry price={getPassPrice()} />
      </Suspense>
    </CustomerShell>
  );
}
