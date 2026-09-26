import { ButtonLink } from "@/components/customer/ui";
import type { Metadata } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { RecoveryDashboard } from "@/components/customer/recovery/recovery-dashboard";

export const metadata: Metadata = {
  title: "Recovery card",
  description: "Create and manage your lost-phone recovery card."
};

export default function RecoveryPage() {
  return (
    <CustomerShell active="wallet" title="Recovery card" back={{ href: "/wallet", label: "Wallet" }}>
      <div className="pt-5"><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-ad7bbbadcdc1-1" : undefined}>This card helps a finder contact you. To restore your account after losing both your phone and Zik Card, use your 24-word recovery phrase.</p><ButtonLink href="/account-recovery" variant="secondary" className="mt-3">Account recovery and seed phrase</ButtonLink></div>
      <RecoveryDashboard />
    </CustomerShell>
  );
}
