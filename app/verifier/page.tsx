import { AppShell } from "@/components/app-shell";
import { VerifierDemo } from "@/components/verifier-demo";
import { getIssuerPublicKey } from "@/lib/server/issuer-keys";

export default async function VerifierPage() {
  const issuerPublicKey = await getIssuerPublicKey();

  return (
    <AppShell currentPath="/verifier">
      <main className="grid gap-6">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Dummy betting vendor</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/70">
            This surface simulates an adult-content vendor that asks for one Zik Pass approval at
            the point of entry, then validates the credential locally without calling the issuer.
          </p>
        </div>
        <VerifierDemo issuerPublicKey={issuerPublicKey} />
      </main>
    </AppShell>
  );
}
