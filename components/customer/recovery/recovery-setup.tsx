"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import { Alert, Button, ButtonLink, Sheet } from "@/components/customer/ui";
import * as ownerSession from "@/lib/client/recovery/owner-session";
import * as api from "@/lib/client/recovery/api";
import type { OwnerCardView } from "@/lib/client/recovery/api";

type Step = "welcome" | "passphrase" | "channel" | "return-details" | "complete";

export function RecoverySetup({ onCreated }: { onCreated: (card: OwnerCardView) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [card, setCard] = useState<OwnerCardView | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (!busy) setOpen(false);
  }

  return (
    <>
      <div className="mt-7 rounded-none border border-[#e4dfc8] bg-[#faf8ed] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-[360px]">
            <p className="text-[12px] font-extrabold tracking-[0.16em] text-[#65604c]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-1" : undefined}>NO RECOVERY CARD YET</p>
            <h2 className="mt-2 text-[22px] font-bold tracking-[-0.03em]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-2" : undefined}>If your phone is lost, a finder can reach you privately.</h2>
            <p className="mt-2 text-[14px] leading-6 text-[#55594f]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-3" : undefined}>
              Create a lock-screen card with a QR code. Whoever finds your phone can scan it and start a private, encrypted conversation — no account or app install needed on their side.
            </p>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>Create recovery card</Button>
        </div>
      </div>

      <Sheet open={open} onClose={close} title={step === "complete" ? "Recovery card ready" : "Create your recovery card"}>
        {step === "welcome" ? <Welcome onContinue={() => setStep("passphrase")} /> : null}
        {step === "passphrase" ? (
          <PassphraseStep
            busy={busy}
            error={error}
            onBack={() => setStep("welcome")}
            onSubmit={async (passphrase) => {
              setBusy(true);
              setError("");
              try {
                const created = await ownerSession.setUpCard(passphrase);
                setCard(created);
                setStep("channel");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create your recovery card.");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}
        {step === "channel" && card ? (
          <ChannelStep
            card={card}
            onSkip={() => setStep("return-details")}
            onVerified={(next) => {
              setCard(next);
              setStep("return-details");
            }}
          />
        ) : null}
        {step === "return-details" && card ? (
          <ReturnDetailsStep
            card={card}
            onDone={(next) => {
              setCard(next);
              setStep("complete");
            }}
          />
        ) : null}
        {step === "complete" && card ? (
          <CompleteStep
            card={card}
            onDone={() => {
              setOpen(false);
              onCreated(card);
            }}
          />
        ) : null}
      </Sheet>
    </>
  );
}

function Welcome({ onContinue }: { onContinue: () => void }) {
  return (
    <div>
      <p className="text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-4" : undefined}>
        Your recovery card uses an opaque, revocable ID — not your name, phone number or address. A finder never sees your account.
      </p>
      <ul className="mt-4 space-y-3 text-[14px]">
        <li className="rounded-none bg-[var(--zk-sunken)] p-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-5" : undefined}><strong>Private by design.</strong> The finder gets a chat, not your identity.</li>
        <li className="rounded-none bg-[var(--zk-sunken)] p-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-6" : undefined}><strong>End-to-end encrypted.</strong> Zik relays the conversation but cannot read it.</li>
        <li className="rounded-none bg-[var(--zk-sunken)] p-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-7" : undefined}><strong>Works if you have no phone.</strong> A printable card or sticker works the same as the lock-screen image — but only a screen with power can show a QR code.</li>
      </ul>
      <Button type="button" size="lg" className="mt-5" onClick={onContinue}>Continue</Button>
    </div>
  );
}

function PassphraseStep({
  busy,
  error,
  onBack,
  onSubmit
}: {
  busy: boolean;
  error: string;
  onBack: () => void;
  onSubmit: (passphrase: string) => void;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (passphrase.length < 12) {
      setLocalError("Use at least 12 characters.");
      return;
    }
    if (passphrase !== confirmation) {
      setLocalError("The passphrases do not match.");
      return;
    }
    setLocalError("");
    onSubmit(passphrase);
  }

  return (
    <form onSubmit={submit}>
      <p className="text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-8" : undefined}>
        Choose a messaging passphrase. It protects the key that reads your recovery conversations — not your Vault passphrase, and not your Zik card PIN. Write it down somewhere separate from your phone.
      </p>
      <div className="mt-4 space-y-3">
        <label className="block text-[13px] font-semibold">
          Messaging passphrase
          <input
            className="mt-1.5 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]"
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            required
            minLength={12}
            maxLength={1024}
            autoComplete="new-password"
          />
        </label>
        <label className="block text-[13px] font-semibold">
          Confirm passphrase
          <input
            className="mt-1.5 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]"
            type="password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
            minLength={12}
            maxLength={1024}
            autoComplete="new-password"
          />
        </label>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-9" : undefined}>
        Zik never stores or sees this passphrase. If you lose it and lose your trusted device, old recovery conversations cannot be read — you would set up a new card.
      </p>
      {localError || error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{localError || error}</p> : null}
      <div className="mt-5 flex justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack} disabled={busy}>Back</Button>
        <Button type="submit" loading={busy}>Create card</Button>
      </div>
    </form>
  );
}

function ChannelStep({
  card,
  onSkip,
  onVerified
}: {
  card: OwnerCardView;
  onSkip: () => void;
  onVerified: (card: OwnerCardView) => void;
}) {
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const local = useRef<{ cardId: string; ownerSecret: string } | undefined>(undefined);

  useEffect(() => {
    void ownerSession.currentOwnerSecret().then((value) => { local.current = value; });
  }, []);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    if (!local.current) return;
    setBusy(true);
    setError("");
    try {
      await api.startChannelVerification(card.card_id, local.current.ownerSecret, address);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(event: FormEvent) {
    event.preventDefault();
    if (!local.current) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.confirmChannelVerification(card.card_id, local.current.ownerSecret, code);
      onVerified(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect or expired code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-10" : undefined}>
        Add an email address you can reach even without this phone. Recovery setup isn&apos;t complete until it&apos;s verified — this is how you&apos;ll hear when someone finds your phone.
      </p>
      {!sent ? (
        <form onSubmit={sendCode} className="mt-4">
          <label className="block text-[13px] font-semibold">
            Email address
            <input
              className="mt-1.5 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]"
              type="email"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}
          <div className="mt-5 flex justify-between gap-3">
            <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>Skip for now</Button>
            <Button type="submit" loading={busy}>Send code</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={confirmCode} className="mt-4">
          <Alert tone="info" title="Check your email">We sent a 6-digit code to {address}. It expires in 15 minutes.</Alert>
          <label className="mt-4 block text-[13px] font-semibold">
            Code
            <input
              className="mt-1.5 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px] tracking-[0.3em]"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              maxLength={6}
            />
          </label>
          {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}
          <div className="mt-5 flex justify-between gap-3">
            <Button type="button" variant="ghost" onClick={onSkip} disabled={busy}>Skip for now</Button>
            <Button type="submit" loading={busy}>Confirm</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ReturnDetailsStep({ card, onDone }: { card: OwnerCardView; onDone: (card: OwnerCardView) => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(withDetails: boolean) {
    setBusy(true);
    setError("");
    try {
      const local = await ownerSession.currentOwnerSecret();
      if (!local) throw new Error("This device is not set up as the card owner.");
      const next = withDetails
        ? await api.setReturnDetails(card.card_id, local.ownerSecret, { note: note.trim() || undefined })
        : card;
      onDone(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save return details.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-[14px] leading-6 text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bd4c4790bc8-11" : undefined}>
        Optionally, show a short public note on the finder&apos;s page — for example, a return suggestion. This is visible to anyone who scans the card. Your home address is never shown unless you type it here yourself, and we recommend you don&apos;t.
      </p>
      <label className="mt-4 block text-[13px] font-semibold">
        Public note (optional)
        <textarea
          className="mt-1.5 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3 text-[16px]"
          rows={3}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="e.g. Reward offered — please contact me, no questions asked."
        />
      </label>
      {error ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{error}</p> : null}
      <div className="mt-5 flex justify-between gap-3">
        <Button type="button" variant="ghost" onClick={() => void submit(false)} disabled={busy}>Skip</Button>
        <Button type="button" loading={busy} onClick={() => void submit(true)}>Save and continue</Button>
      </div>
    </div>
  );
}

function CompleteStep({ card, onDone }: { card: OwnerCardView; onDone: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const recoveryUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${card.card_id}` : `/r/${card.card_id}`;

  useEffect(() => {
    let live = true;
    void QRCode.toDataURL(recoveryUrl, { width: 480, margin: 2 }).then((value) => {
      if (live) setQrDataUrl(value);
    });
    return () => { live = false; };
  }, [recoveryUrl]);

  async function downloadCard() {
    if (!qrDataUrl) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 900;
      canvas.height = 1400;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no_canvas");
      ctx.fillStyle = "#0e1726";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 46px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Found this phone?", canvas.width / 2, 140);
      ctx.font = "32px sans-serif";
      ctx.fillText("Scan to contact me privately.", canvas.width / 2, 200);

      const qr = new Image();
      await new Promise<void>((resolve, reject) => {
        qr.onload = () => resolve();
        qr.onerror = () => reject(new Error("qr_load_failed"));
        qr.src = qrDataUrl;
      });
      const qrSize = 620;
      ctx.drawImage(qr, (canvas.width - qrSize) / 2, 280, qrSize, qrSize);

      ctx.font = "28px monospace";
      ctx.fillText(recoveryUrl.replace(/^https?:\/\//, ""), canvas.width / 2, 980);
      ctx.font = "22px sans-serif";
      ctx.fillStyle = "#b8c2d1";
      ctx.fillText("A screen-based code can't help if this phone has no power.", canvas.width / 2, 1040);
      ctx.fillText("Keep a printed copy or sticker with this same code as a backup.", canvas.width / 2, 1075);

      const link = document.createElement("a");
      link.download = "zik-recovery-card.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      setDownloadError("Could not generate the downloadable card image. You can still screenshot this screen.");
    }
  }

  return (
    <div>
      <Alert tone="positive" title="Your recovery card is ready">
        Set this as your lock screen, or print it. Anyone who scans it can start a private conversation with you — never your Vault, your identity, or this device&apos;s contents.
      </Alert>
      <div className="mt-4 flex justify-center">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt={`QR code linking to ${recoveryUrl}`} className="h-56 w-56" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-none bg-[var(--zk-sunken)]" />
        )}
      </div>
      <p className="mt-3 break-all text-center text-[13px] text-[var(--zk-text-soft)]">{recoveryUrl}</p>
      {!card.channel?.verified_at ? (
        <Alert tone="caution" title="No verified contact yet">
          You skipped email verification, so you won&apos;t be notified automatically. Add and verify one from the recovery dashboard when you can.
        </Alert>
      ) : null}
      {downloadError ? <p className="mt-3 text-[13px] font-semibold text-[var(--zk-critical)]" role="alert">{downloadError}</p> : null}
      <div className="mt-4 rounded-none bg-[var(--zk-sunken)] p-3.5 text-[13px]">
        Next, consider setting up <ButtonLink href="/vault" variant="ghost" size="md" className="!inline-flex !min-h-0 !px-1 !underline">Zik Vault</ButtonLink> — recovery gets your phone back; Vault keeps what&apos;s on it recoverable too.
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <Button type="button" variant="secondary" onClick={() => void downloadCard()}>Download printable card</Button>
        <Button type="button" size="lg" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}
