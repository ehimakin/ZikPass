"use client";

import { AccountRecoveryPrompt } from "@/components/customer/account-recovery/recovery-prompt";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { VaultV2 } from "@/lib/client/vault/session";
import { selfEntered } from "@/lib/shared/vault";
import type { VaultProfileV2 } from "@/lib/shared/vault/model";
import { Alert, Button, Sheet, StatusBadge } from "@/components/customer/ui";

type Step = "welcome" | "payment" | "setup" | "complete";

export function VaultSignup({ vault, onCreated }: { vault: VaultV2; onCreated: (profile: VaultProfileV2) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState({
    legalName: "",
    deliveryAddress: "",
    email: "",
    passphrase: "",
    confirmation: ""
  });
  const createdProfile = useRef<VaultProfileV2 | undefined>(undefined);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("zik-vault-onboarding") === "paid") setStep("setup");
    } catch {
      // Private browsing can make localStorage unavailable. The flow still works in memory.
    }
  }, []);

  function close() {
    if (!paying && !saving) setOpen(false);
  }

  async function pay() {
    setPaying(true);
    setError("");
    await new Promise(resolve => window.setTimeout(resolve, 700));
    try {
      window.localStorage.setItem("zik-vault-onboarding", "paid");
    } catch {
      // Persistence is only a convenience for resuming this preview flow.
    }
    setPaying(false);
    setStep("setup");
  }

  async function createVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (values.passphrase !== values.confirmation) {
      setError("The passphrases do not match.");
      return;
    }

    setSaving(true);
    try {
      const updatedAt = new Date().toISOString();
      const profile: VaultProfileV2 = {
        version: 2,
        legal_name: selfEntered({ value: values.legalName, provenance: "self_entered", updated_at: updatedAt }),
        delivery_address: selfEntered({ value: values.deliveryAddress, provenance: "self_entered", updated_at: updatedAt }),
        ...(values.email.trim() ? { email: selfEntered({ value: values.email, provenance: "self_entered", updated_at: updatedAt }) } : {}),
        designations: []
      };
      await vault.create(profile, values.passphrase);
      createdProfile.current = profile;
      try {
        window.localStorage.removeItem("zik-vault-onboarding");
      } catch {
        // The encrypted Vault itself is the source of truth.
      }
      setStep("complete");
    } catch {
      setError("This device could not create your encrypted Vault. Use HTTPS or localhost and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="mt-7 rounded-none border border-[#e4dfc8] bg-[#faf8ed] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[360px]">
          <p className="text-[12px] font-extrabold tracking-[0.16em] text-[#65604c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-1" : undefined}>NO VAULT ON THIS DEVICE</p>
          <h2 className="mt-2 text-[22px] font-bold tracking-[-0.03em]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-2" : undefined}>Make this space yours.</h2>
          <p className="mt-2 text-[14px] leading-6 text-[#55594f]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-3" : undefined}>Keep your documents encrypted on this device. 35p/month; subscription billing is not connected yet.</p>
        </div>
        <Button type="button" onClick={() => setOpen(true)}>Get Zik Vault</Button>
      </div>
    </div>

    <Sheet open={open} onClose={close} title={step === "complete" ? "Vault created" : "Get Zik Vault"}>
      {step === "welcome" ? <Welcome onContinue={() => setStep("payment")} /> : null}
      {step === "payment" ? <Payment paying={paying} onBack={() => setStep("welcome")} onPay={() => void pay()} /> : null}
      {step === "setup" ? <Setup values={values} setValues={setValues} error={error} saving={saving} onSubmit={createVault} /> : null}
      {step === "complete" ? <Complete onDone={() => { if (!createdProfile.current) return; setOpen(false); onCreated(createdProfile.current); }} /> : null}
    </Sheet>
  </>;
}

function Welcome({ onContinue }: { onContinue: () => void }) {
  return <div>
    <p className="text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-4" : undefined}>Your Vault keeps the details you add encrypted in this browser. Zik does not receive your profile or passphrase.</p>
    <ul className="mt-4 space-y-3 text-[14px]">
      <li className="rounded-none bg-[var(--zk-sunken)] p-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-5" : undefined}><strong>Private by design.</strong> Your encrypted Vault stays on this device.</li>
      <li className="rounded-none bg-[var(--zk-sunken)] p-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-6" : undefined}><strong>You hold the key.</strong> Your passphrase cannot be recovered by Zik.</li>
      <li className="rounded-none bg-[var(--zk-sunken)] p-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-7" : undefined}><strong>Choose what leaves.</strong> Nothing is shared without your approval.</li>
    </ul>
    <Button type="button" size="lg" className="mt-5" onClick={onContinue}>Continue</Button>
  </div>;
}

function Payment({ paying, onBack, onPay }: { paying: boolean; onBack: () => void; onPay: () => void }) {
  return <div className="space-y-5">
    <StatusBadge>Early Access</StatusBadge>
    <h3 className="text-2xl font-bold">Your private document space.</h3>
    <p className="text-sm text-[var(--zk-text-soft)]">Zik Vault · 35p/month. Zik VaultCloud · 99p/month. No charge or subscription starts in this preview.</p>
    <details className="rounded-2xl bg-[var(--zk-sunken)] p-4 text-sm"><summary className="cursor-pointer font-semibold">Future subscriptions</summary><p className="mt-3">On iPhone, paid plans will use Apple’s In-App Purchase confirmation, with the price and renewal terms shown before you subscribe. Purchases and subscription management are not connected yet.</p></details>
    <Button size="lg" onClick={onPay} loading={paying}>Create my Vault</Button>
    <Button variant="ghost" onClick={onBack} disabled={paying}>Back</Button>
  </div>;
}

type Values = { legalName: string; deliveryAddress: string; email: string; passphrase: string; confirmation: string };

function Setup({ values, setValues, error, saving, onSubmit }: { values: Values; setValues: (values: Values) => void; error: string; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const field = (name: keyof Values) => ({ value: values[name], onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [name]: event.target.value }) });
  const inputClass = "mt-1.5 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]";
  return <form onSubmit={onSubmit}>
    <StatusBadge tone="positive">Vault preview · No subscription started</StatusBadge>
    <p className="mt-3 text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-12" : undefined}>Now add the basics for your device Vault. You can edit these later.</p>
    <div className="mt-4 space-y-3">
      <label className="block text-[13px] font-semibold">Legal name<input {...field("legalName")} className={inputClass} required maxLength={200} autoComplete="name" /></label>
      <label className="block text-[13px] font-semibold">Delivery address<textarea {...field("deliveryAddress")} className={inputClass} required maxLength={500} rows={3} autoComplete="street-address" /></label>
      <label className="block text-[13px] font-semibold">Email <span className="font-normal text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-13" : undefined}>(optional)</span><input {...field("email")} className={inputClass} type="email" maxLength={320} autoComplete="email" /></label>
      <label className="block text-[13px] font-semibold">Create a passphrase<input {...field("passphrase")} className={inputClass} type="password" required minLength={12} maxLength={1024} autoComplete="new-password" /></label>
      <label className="block text-[13px] font-semibold">Confirm passphrase<input {...field("confirmation")} className={inputClass} type="password" required minLength={12} maxLength={1024} autoComplete="new-password" /></label>
    </div>
    <p className="mt-3 text-[12px] leading-5 text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-cf6999a23b54-14" : undefined}>Use at least 12 characters. Zik cannot reset this passphrase. Set up a recovery phrase and encrypted backup after creating your Vault to protect against losing this device.</p>
    {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}
    <Button type="submit" size="lg" className="mt-5" loading={saving}>Create encrypted Vault</Button>
  </form>;
}

function Complete({ onDone }: { onDone: () => void }) {
  return <div>
    <Alert tone="positive" title="Your encrypted Vault is ready">It is stored on this device. Unlock it with the passphrase you just created.</Alert>
    <div className="mt-5"><AccountRecoveryPrompt /></div>
    <Button type="button" size="lg" className="mt-5" onClick={onDone}>Go to my Vault</Button>
  </div>;
}
