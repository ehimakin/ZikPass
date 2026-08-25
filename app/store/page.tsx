import { AppShell } from "@/components/app-shell";
import { StoreSessionDashboard } from "@/components/store-session-dashboard";

export default function StorePage() {
  return (
    <AppShell currentPath="/store">
      <main className="grid gap-6 pb-16 pt-6">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-lime/80">Staff tool</p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-mist">Store verification</h1>
        </div>
        <StoreSessionDashboard />
      </main>
    </AppShell>
  );
}
