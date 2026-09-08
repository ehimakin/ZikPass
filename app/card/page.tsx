import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { CounterActivation } from "@/components/customer/counter-activation";
import { getPassPrice } from "@/lib/shared/payment-config";
export const metadata = { title: "Activate your Zik Pass", description: "Finish your paid in-store Zik Pass setup on this device." };
export default function CardActivationPage() {
  return <CustomerShell active="home" back={{ href: "/home", label: "Home" }}><Suspense fallback={null}><CounterActivation price={getPassPrice()} /></Suspense></CustomerShell>;
}
