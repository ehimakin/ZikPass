import type { Metadata } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { VaultEntry } from "@/components/customer/vault-entry";

export const metadata: Metadata = { title: "Zik Vault preview", description: "A preview of Zik Vault." };

export default function VaultPreviewPage() {
  return <CustomerShell active="vault" immersive><VaultEntry previewMode /></CustomerShell>;
}
