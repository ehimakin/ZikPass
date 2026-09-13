"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { ZikLogoMark } from "@/components/zik-logo";
import { Alert, Button } from "@/components/customer/ui";
import { environmentBadgeLabel, isDemoEnvironment } from "@/lib/shared/demo-environment";
import { ZIK_STORES } from "@/lib/shared/stores";

export function StoreLogin({ nextPath = "/verify" }: { nextPath?: string }) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(ZIK_STORES[0].id);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedStore = ZIK_STORES.find((store) => store.id === storeId) ?? ZIK_STORES[0];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/operator/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, code })
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Login failed.");
      router.replace(nextPath as Route);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Login failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="zk-surface min-h-[100dvh] bg-[var(--zk-canvas)] px-4 py-8 sm:py-14">
      <main className="mx-auto w-full max-w-[520px]">
        <header className="mb-8 flex items-center justify-between gap-4">
          <span className="flex items-center gap-3">
            <ZikLogoMark className="h-10 w-10" />
            <span>
              <span className="block text-[18px] font-extrabold tracking-tight">Zik Pass</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--zk-text-soft)]">Store portal</span>
            </span>
          </span>
          <span className="rounded-full bg-[var(--zk-sunken)] px-3 py-1.5 text-[11px] font-semibold text-[var(--zk-text-soft)]">
            {environmentBadgeLabel()}
          </span>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-[var(--zk-line)] bg-[var(--zk-card)] shadow-[var(--zk-shadow-card)]">
          <div className="bg-[var(--zk-ink-surface)] px-6 py-7 text-[var(--zk-text-on-ink)] sm:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#d7f171]">Clerk access</p>
            <h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-[-0.035em]">Set up this store terminal.</h1>
            <p className="mt-3 max-w-[390px] text-[14px] leading-relaxed text-[#b9c0cb]">Choose your location and enter the staff login code before helping customers.</p>
          </div>

          <form onSubmit={submit} className="space-y-6 p-6 sm:p-8">
            {error ? <Alert tone="critical" title="Couldn’t sign in">{error}</Alert> : null}

            <fieldset>
              <legend className="mb-3 text-[13px] font-bold text-[var(--zk-text)]">1. Select your store</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ZIK_STORES.map((store) => {
                  const selected = store.id === storeId;
                  return (
                    <label key={store.id} className={`cursor-pointer rounded-[14px] border p-3.5 transition ${selected ? "border-[#16202f] bg-[#f1f3e8] ring-1 ring-[#16202f]" : "border-[var(--zk-line)] hover:border-[var(--zk-line-strong)]"}`}>
                      <input className="sr-only" type="radio" name="store" value={store.id} checked={selected} onChange={() => setStoreId(store.id)} />
                      <span className="block text-[13px] font-bold">{store.name}</span>
                      <span className="mt-1 block text-[11px] text-[var(--zk-text-soft)]">{store.area} · {store.postcode}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="text-[13px] font-bold text-[var(--zk-text)]">2. Enter staff login code</span>
              <input
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                aria-describedby="clerk-code-help"
                className="mt-3 block min-h-[62px] w-full rounded-[14px] border border-[var(--zk-line-strong)] bg-[var(--zk-sunken)] px-5 text-center font-mono text-[28px] font-bold tracking-[0.38em] outline-none transition focus:border-[var(--zk-focus)] focus:ring-2 focus:ring-[var(--zk-focus)]/20"
              />
              <span id="clerk-code-help" className="mt-2 block text-[11px] leading-relaxed text-[var(--zk-text-soft)]">
                {isDemoEnvironment ? "Development access code: 8640." : "Use the four-digit code provided to your store manager."}
              </span>
            </label>

            <div className="rounded-[14px] bg-[var(--zk-sunken)] p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--zk-text-faint)]">Signing in to</p>
              <p className="mt-1 text-[14px] font-bold">{selectedStore.name}</p>
              <p className="mt-1 text-[12px] text-[var(--zk-text-soft)]">{selectedStore.addressLine}, {selectedStore.postcode}</p>
            </div>

            <Button type="submit" size="lg" loading={busy} disabled={code.length !== 4}>
              Open clerk tools
            </Button>
            <p className="text-center text-[10px] leading-relaxed text-[var(--zk-text-faint)]">This development login protects the clerk interface only. Do not reuse the shared demonstration code in a live environment.</p>
          </form>
        </section>
      </main>
    </div>
  );
}
