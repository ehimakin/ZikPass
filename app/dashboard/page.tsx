import { CustomerShell } from "@/components/customer/customer-shell";
import Link from "next/link";
import type { Route } from "next";
import { DASHBOARD_ROLES } from "@/lib/shared/dashboard";
export default function DashboardPage() {
  return <CustomerShell active="about" title="Dashboard" immersive><section className="mx-auto max-w-6xl px-6 pt-12 pb-28">
    <p className="text-xs font-bold uppercase tracking-widest" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e16c1c1133d5-1" : undefined}>Zik Pass workspace</p>
    <h1 className="mt-3 text-4xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e16c1c1133d5-2" : undefined}>Your dashboard</h1>
    <p className="mt-4 max-w-2xl text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e16c1c1133d5-3" : undefined}>Choose your workspace. Each area uses its own credentials; choosing a role does not grant access.</p>
    <div className="mt-8 grid gap-5 md:grid-cols-2">{DASHBOARD_ROLES.map(role => <Link key={role.id} href={role.href as Route} className="rounded-xl border border-[var(--zk-line)] bg-[var(--zk-card)] p-7 hover:border-[var(--zk-text)] focus-visible:outline focus-visible:outline-2">
      <h2 className="text-2xl font-bold">{role.title}</h2><p className="mt-3 text-[var(--zk-text-soft)]">{role.description}</p><span className="mt-6 block font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e16c1c1133d5-4" : undefined}>Open workspace →</span>
    </Link>)}</div>
  </section></CustomerShell>;
}
