"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadWalletState } from "@/lib/client/wallet-client";
import { hasApplicationRecord } from "@/lib/client/vault/store";
import type { WalletState } from "@/lib/shared/types";
import { Alert, Button, ButtonLink, Skeleton, StatusBadge } from "./ui";

export function WalletScreen() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [application, setApplication] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    void loadWalletState().then(value => { if (!cancelled) setWallet(value); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => {
    let cancelled = false;
    void hasApplicationRecord().then(value => { if (!cancelled) setApplication(value); });
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const credential = wallet?.credential;
  const expired = credential && Date.parse(credential.payload.expires_at) <= now;
  const active = credential && !expired && Date.parse(credential.payload.activates_at) <= now;
  const status = credential ? expired ? "Expired" : active ? "Active" : "Activating" : wallet?.enrollmentId ? "In progress" : "Not added";

  return <div className="space-y-6 py-6">
    <header className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-1" : undefined}>Your credentials</p>
      <h1 className="text-4xl font-extrabold tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-2" : undefined}>Wallet</h1>
      <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-3" : undefined}>Choose a credential to open and use.</p>
    </header>
    {failed ? <Alert tone="caution" title="Couldn’t open your wallet" action={<Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}>Your saved credentials haven’t been changed.</Alert> : !wallet ? <div role="status" aria-label="Loading wallet"><Skeleton className="h-64 w-full rounded-none" /></div> : <section aria-label="Your credentials">
      <Link href="/pass" aria-label="Open Zik Pass" className="block rounded-3xl border border-[#cbb95b] bg-[#faf8ed] p-6 shadow-sm transition hover:border-[#28623c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#28623c]">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-4" : undefined}><span className="text-[#28623c]">Zik</span> Pass</h2><StatusBadge tone={expired ? "critical" : active ? "positive" : "neutral"}>{status}</StatusBadge></div>
        <div className="py-8"><p className="text-6xl font-extrabold tracking-tight text-[#28623c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-5" : undefined}>18+</p><p className="mt-2 text-sm text-[var(--zk-text-soft)]">{credential ? "Your proof of adult status" : wallet.enrollmentId ? "Continue setting up your proof of age" : "Your proof of age belongs here"}</p></div>
        <div className="flex items-center justify-between border-t border-[#e4dfc8] pt-4 text-sm font-semibold"><span>{credential ? "Open Zik Pass" : wallet.enrollmentId ? "View pass progress" : "Explore Zik Pass"}</span><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-6" : undefined}>→</span></div>
      </Link>
      {!credential && !wallet.enrollmentId ? <div className="mt-4"><ButtonLink href="/find" size="lg">Get Zik Pass</ButtonLink></div> : null}
      {application ? <Link href="/id/apply" aria-label="Open your Zik ID application" className="mt-4 block rounded-3xl border border-[#e4dfc8] bg-white p-6 transition hover:border-[#cbb95b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#28623c]">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold"><span className="text-[#28623c]">Zik</span> ID</h2><StatusBadge tone="neutral">Application saved</StatusBadge></div>
        <p className="mt-4 text-sm text-[var(--zk-text-soft)]">Your application is held in your Vault on this device. Zik ID identity checks are not available yet, so nothing has been approved or issued.</p>
        <div className="mt-5 flex items-center justify-between border-t border-[#e4dfc8] pt-4 text-sm font-semibold"><span>Unlock your Vault to view it</span><span aria-hidden="true">→</span></div>
      </Link> : null}
    </section>}
    <div className="flex justify-center border-t border-[var(--zk-line)] pt-5"><ButtonLink href="/vault" className="!bg-[#424242] !text-white hover:!bg-[#303030] active:!bg-[#252525]">Go to Vault</ButtonLink></div>
  </div>;
}
