import { AppShell } from "@/components/app-shell";
import { IssuerDashboard } from "@/components/issuer-dashboard";

export default function IssuerPage() {
  return (
    <AppShell currentPath="/issuer">
      <main className="grid gap-6 pb-16 pt-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-lime/80">Staff tool</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-mist">Issuer dashboard</h1>
        </div>
        <IssuerDashboard />
      </main>
    </AppShell>
  );
}
