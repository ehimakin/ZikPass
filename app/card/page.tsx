import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { PurchaseActivation } from "@/components/customer/purchase-activation";
import { getPassPrice } from "@/lib/shared/payment-config";
export const metadata = { title: "Activate your Zik Pass", description: "Finish your paid in-store Zik Pass setup on this device." };
export default function CardActivationPage() {
  return <CustomerShell active="home" back={{ href: "/home", label: "Home" }}><Suspense fallback={null}><PurchaseActivation price={getPassPrice()} /></Suspense></CustomerShell>;
}
