import { AppShell } from "@/components/app-shell";
import { StoreSessionDashboard } from "@/components/store-session-dashboard";

export default function VerifyPage() {
  return (
    <AppShell currentPath="/verify">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">
            Retail verification
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            Resolve the temporary customer QR/code, check the physical ID in person, then submit an
            authorised 18+ attestation to Zik.
          </p>
        </div>
        <StoreSessionDashboard />
      </main>
    </AppShell>
  );
}
