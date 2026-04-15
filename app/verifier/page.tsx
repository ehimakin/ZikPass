import { AppShell } from "@/components/app-shell";
import { VerifierDemo } from "@/components/verifier-demo";

export default function VerifierPage() {
  return (
    <AppShell currentPath="/verifier">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">ZikBet vendor demo</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            This surface simulates a standalone betting site that launches a Zik-hosted age
            verification flow in a modal and receives only a minimal over-18 result in return.
          </p>
        </div>
        <VerifierDemo />
      </main>
    </AppShell>
  );
}
