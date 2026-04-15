import { AppShell } from "@/components/app-shell";
import { StoreSessionDashboard } from "@/components/store-session-dashboard";

export default function StorePage() {
  return (
    <AppShell currentPath="/store">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Store verification</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            Create QR-backed in-store sessions, look up a customer by short code, and confirm that
            a clerk has checked physical ID before the device-auth step completes.
          </p>
        </div>
        <StoreSessionDashboard />
      </main>
    </AppShell>
  );
}
