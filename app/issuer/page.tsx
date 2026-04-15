import { AppShell } from "@/components/app-shell";
import { IssuerDashboard } from "@/components/issuer-dashboard";

export default function IssuerPage() {
  return (
    <AppShell currentPath="/issuer">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Issuer admin</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            The issuer surface shows proof intake, evaluation outcomes, refund-code verification,
            cooling-off state, pending issuance records, notification logging, and credential
            signing using a server-only key.
          </p>
        </div>
        <IssuerDashboard />
      </main>
    </AppShell>
  );
}
