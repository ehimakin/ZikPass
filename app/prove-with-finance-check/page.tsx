import { CustomerShell } from "@/components/customer/customer-shell";
import { FinanceCheckPreview } from "@/components/customer/finance-check-preview";
export const metadata = { title: "Zik Pass via Finance Check · Zik", description: "Your proof of age, in your pocket. Start with a finance check." };
export default function FinanceCheckPage() {
  return <CustomerShell active="wallet" title="Finance check"><div className="space-y-6 py-6"><header><h1 className="text-4xl font-extrabold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-1" : undefined}>Skip the store. Coming soon.</h1><p className="mt-3 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-062a2edd3861-2" : undefined}>A separate remote route · £3.99 one-off.</p></header><FinanceCheckPreview /></div></CustomerShell>;
}
