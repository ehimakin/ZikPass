import { FindStoreMap } from "@/components/customer/find-store-map";
import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink } from "@/components/customer/ui";
export default function FindStorePage() {
  return <CustomerShell active="find"><div className="space-y-6 py-6"><header><h1 className="text-4xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-81beef8f0747-1" : undefined}>Find your Zik spot.</h1><p className="mt-3 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-81beef8f0747-2" : undefined}>Physical cards and in-person checks, close to home.</p></header><FindStoreMap /><ButtonLink href="/card/pair" variant="secondary" size="lg">I already have a card</ButtonLink><ButtonLink href="/partner_stores" variant="ghost">Bring Zik to your store →</ButtonLink></div></CustomerShell>;
}
