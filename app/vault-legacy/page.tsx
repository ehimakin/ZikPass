import { CustomerShell } from "@/components/customer/customer-shell";
import { PhoneHero } from "@/components/customer/home-screen";
import { VaultScreen } from "@/components/customer/vault-screen";

export default function Page() {
  return (
    <CustomerShell active="vault" hero={<PhoneHero />}>
      <div className="min-h-[120px]" aria-hidden="true" />
      <div className="relative -mx-4 min-h-[60vh] bg-[var(--zk-canvas)] px-4 pb-10 pt-6 shadow-[0_-10px_30px_rgba(14,23,38,0.08)]">
        <div className="mx-auto max-w-[460px]">
          <VaultScreen />
        </div>
      </div>
    </CustomerShell>
  );
}
