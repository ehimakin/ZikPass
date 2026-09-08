import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { PassScreen } from "@/components/customer/pass-screen";

export default function MyPassPage() {
  return (
    <CustomerShell active="pass">
      <Suspense fallback={null}>
        <PassScreen />
      </Suspense>
    </CustomerShell>
  );
}
