import { VaultEntry } from "@/components/customer/vault-entry";
import { ButtonLink } from "@/components/customer/ui";
export default function Page() {
  return <main><section className="mx-auto max-w-6xl space-y-4 px-6 py-10"><h1 className="text-4xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-689d7c074448-1" : undefined}>Customer workspace</h1><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-689d7c074448-2" : undefined}>Unlock your Vault on this device to manage private documents and settings.</p><div className="flex flex-wrap gap-3"><ButtonLink href="/dashboard/customer/wallet">Wallet</ButtonLink><ButtonLink href="/dashboard/customer/recovery">Recovery</ButtonLink><ButtonLink href="/help">Help and support</ButtonLink></div></section><VaultEntry /></main>;
}
