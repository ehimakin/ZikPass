"use client";

import { FinanceCheckPreview } from "./finance-check-preview";
import { AccountRecoveryPrompt } from "@/components/customer/account-recovery/recovery-prompt";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadWalletState } from "@/lib/client/wallet-client";
import { hasApplicationRecord } from "@/lib/client/vault/store";
import { AppleWalletButton } from "./apple-wallet-button";
import { ZikPassCard } from "./zik-pass-card";
import type { EnrollmentRecord, WalletState } from "@/lib/shared/types";
import { Alert, Button, ButtonLink, Skeleton, StatusBadge } from "./ui";

export function WalletScreen({ appleWalletAvailable = false }: { appleWalletAvailable?: boolean }) {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [cardLinked, setCardLinked] = useState<boolean | null>(null);
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
  useEffect(() => {
    let cancelled = false;
    setCardLinked(null);
    if (wallet && !wallet.credential) setCardLinked(false);
    if (wallet?.credential && wallet.enrollmentId) {
      void fetch(`/api/enrollment/${encodeURIComponent(wallet.enrollmentId)}`)
        .then(async response => {
          if (!response.ok) return;
          const record = await response.json() as EnrollmentRecord;
          if (!cancelled && record.issued_credential?.payload.credential_id === wallet.credential?.payload.credential_id) {
            setCardLinked(!record.account_recovered_at && record.physical_verification?.session.entry_mode === "retail_card");
          }
        }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [wallet]);
  const pendingCard = Boolean(wallet?.cardDemoCheckoutAt) && cardLinked !== true;
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
    <FinanceCheckPreview compact />
    {failed ? <Alert tone="caution" title="Couldn’t open your wallet" action={<Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}>Your saved credentials haven’t been changed.</Alert> : !wallet ? <div role="status" aria-label="Loading wallet"><Skeleton className="h-64 w-full rounded-none" /></div> : <section aria-label="Your credentials">
      <div className="zk-wallet-pass relative block rounded-3xl p-4">
        <div className="mb-5 flex justify-end"><StatusBadge tone={expired ? "critical" : active ? "positive" : "neutral"}>{pendingCard ? `Pass: ${status}` : status}</StatusBadge></div>
        <div className="relative">
          <ZikPassCard digital={!cardLinked} pending={pendingCard} />
          {credential && !cardLinked && !pendingCard ? <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><ButtonLink href="/ecosystem" variant="secondary" className="pointer-events-auto zk-wallet-digital-explore">Explore Zik ID</ButtonLink></div> : null}
        </div>
        <p className="mt-6 text-sm text-[var(--zk-text-soft)]">{credential ? "Your proof of adult status" : wallet.enrollmentId ? "Continue setting up your proof of age" : "Your proof of age belongs here"}</p>
        <Link href="/pass" className="mt-4 flex items-center justify-between border-t border-[var(--zk-line)] pt-4 text-sm font-semibold after:absolute after:inset-0 after:rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#28623c]"><span>{credential ? cardLinked ? "Open Zik Card" : "Open Zik Pass" : wallet.enrollmentId ? "View pass progress" : "Explore Zik Pass"}</span><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-4" : undefined}>→</span></Link>
      </div>
      {credential ? <div className="mt-4"><AppleWalletButton available={appleWalletAvailable} product="Zik Card" /></div> : null}
      {pendingCard ? <div className="mt-4 space-y-2 rounded-2xl border border-[var(--zk-line)] bg-[var(--zk-sunken)] p-4" role="status">
        <p className="font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-5" : undefined}>Card not linked</p>
        <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-6" : undefined}>Collect a physical card at a participating store, then scan it to link your phone. No card has been ordered.</p>
      </div> : null}
      {cardLinked !== true && !pendingCard ? <div className="mt-4"><ButtonLink href="/find" size="lg" variant="secondary">Find a Zik Card</ButtonLink></div> : null}
      {!credential && !wallet.enrollmentId ? <div className="mt-4"><ButtonLink href="/get-pass" size="lg">Get ZikPass</ButtonLink></div> : null}
      {application ? <Link href="/id/apply" aria-label="Open your Zik ID application" className="mt-4 block rounded-3xl border border-[#e4dfc8] bg-white p-6 transition hover:border-[#cbb95b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#28623c]">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-7" : undefined}><span className="text-[#28623c]">Zik</span> ID</h2><StatusBadge tone="neutral">Application saved</StatusBadge></div>
        <p className="mt-4 text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-8" : undefined}>Your application is held in your Vault on this device. Zik ID identity checks are not available yet, so nothing has been approved or issued.</p>
        <div className="mt-5 flex items-center justify-between border-t border-[#e4dfc8] pt-4 text-sm font-semibold"><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-9" : undefined}>Unlock your Vault to view it</span><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-10" : undefined}>→</span></div>
      </Link> : null}
    </section>}
    <AccountRecoveryPrompt />
    <Link href="/wallet/recovery" className="block rounded-3xl border border-[var(--zk-line)] bg-[var(--zk-card)] p-6 transition hover:border-[#cbb95b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#28623c]">
      <h2 className="text-xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-11" : undefined}>Lost-phone recovery card</h2>
      <p className="mt-3 text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-12" : undefined}>Create and manage your recovery card from your Wallet.</p>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--zk-line)] pt-4 text-sm font-semibold"><span data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-13" : undefined}>Open recovery card</span><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eaaa9ce15387-14" : undefined}>→</span></div>
    </Link>
    <div className="flex justify-center border-t border-[var(--zk-line)] pt-5"><ButtonLink href="/vault" className="!rounded-none !bg-[#424242] !text-white hover:!bg-[#303030] active:!bg-[#252525]">Go to Vault</ButtonLink></div>
  </div>;
}
