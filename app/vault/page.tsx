import type { Metadata } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { VaultEntry } from "@/components/customer/vault-entry";

export const metadata: Metadata = { title: "Zik Vault", description: "A preview of your Zik Vault." };

export default function VaultPage() {
  return <CustomerShell active="pass" immersive><VaultEntry /></CustomerShell>;
}
