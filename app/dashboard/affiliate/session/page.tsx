import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { AffiliatePairedSession } from "@/components/affiliate-paired-session";
export const metadata = { title: "Paired affiliate setup · Zik Pass" };
export default function Page() { return <CustomerShell title="Paired setup" active="about" back={{ href: "/dashboard/affiliate", label: "Affiliate setup" }}><Suspense fallback={<p data-local-edit={process.env.NODE_ENV === "development" ? "ve-0e5372ffd834-1" : undefined}>Loading setup…</p>}><AffiliatePairedSession /></Suspense></CustomerShell>; }
