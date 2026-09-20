import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { ADMIN_COOKIE, readAdminSession } from "@/lib/server/support/auth";
import { AppShell } from "@/components/app-shell";
import { IssuerDashboard } from "@/components/issuer-dashboard";

export default async function IssuerPage() {
  const session = await readAdminSession((await cookies()).get(ADMIN_COOKIE)?.value).catch(() => null);
  if (!session) redirect("/admin" as Route);
  return (
    <AppShell currentPath="/issuer">
      <main className="grid gap-6 pb-16 pt-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-lime/80" data-local-edit={process.env.NODE_ENV === "development" ? "ve-6c4e32686b26-1" : undefined}>Staff tool</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-mist" data-local-edit={process.env.NODE_ENV === "development" ? "ve-6c4e32686b26-2" : undefined}>Issuer dashboard</h1>
        </div>
        <IssuerDashboard />
      </main>
    </AppShell>
  );
}
