"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateMockVaultKey, type VaultOutcome } from "@/lib/client/vault-preview";
import { VaultDemo } from "./vault-demo";
import styles from "./vault-entry.module.css";

type Phase = "idle" | "checking" | Exclude<VaultOutcome, "demo">;

function CombinationDial({ rotation }: { rotation: number }) {
  return <svg className={styles.dial} viewBox="0 0 400 400" aria-hidden="true" focusable="false">
    <circle cx="200" cy="200" r="198" fill="currentColor" />
    <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="3" />
    <path d="m190 12 10 19 10-19" fill="white" />
    <g className={styles.rotor} style={{ transform: `rotate(${rotation}deg)` }} data-testid="vault-dial-rotor">
      {Array.from({ length: 60 }, (_, i) => <rect key={i} x={i % 5 === 0 ? 197 : 199} y="43" width={i % 5 === 0 ? 6 : 2} height={i % 5 === 0 ? 22 : 10} rx="1" fill="white" transform={`rotate(${i * 6} 200 200)`} />)}
      {Array.from({ length: 12 }, (_, i) => <text key={i} x="200" y="91" textAnchor="middle" fill="white" fontSize="15" fontWeight="700" transform={`rotate(${i * 30} 200 200)`}>{i * 5}</text>)}
      <circle cx="200" cy="200" r="94" fill="white" />
      <circle cx="200" cy="200" r="77" fill="currentColor" />
      <circle cx="200" cy="200" r="61" fill="none" stroke="white" strokeWidth="3" />
      <rect x="195" y="137" width="10" height="31" rx="5" fill="white" />
    </g>
  </svg>;
}

function Safe({ phase, attempt }: { phase: Phase; attempt: number }) {
  return <div className={styles.safeWrap} aria-hidden="true">
    <svg key={attempt} className={`${styles.safe} ${phase === "success" ? styles.open : ""} ${phase === "failure" ? styles.alarm : ""}`} viewBox="0 0 440 480" focusable="false" data-testid="vault-safe" data-state={phase}>
      <g className={styles.beacon}>
        <path d="M196 73V58a24 24 0 0 1 48 0v15Z" fill="currentColor" />
        <rect x="188" y="74" width="64" height="9" rx="4" fill="currentColor" />
        <g className={styles.rays} stroke="currentColor" strokeWidth="7" strokeLinecap="round"><path d="M220 9v10M171 25l10 10M259 35l10-10M158 62h12M270 62h12" /></g>
      </g>
      <rect x="62" y="91" width="329" height="333" rx="40" fill="currentColor" />
      <rect x="79" y="108" width="295" height="299" rx="25" fill="white" />
      <rect x="96" y="125" width="261" height="265" rx="12" fill="currentColor" />
      <path d="M105 425h48v19a9 9 0 0 1-9 9h-30a9 9 0 0 1-9-9Zm199 0h48v19a9 9 0 0 1-9 9h-30a9 9 0 0 1-9-9Z" fill="currentColor" />
      <g className={styles.door}>
        <rect x="94" y="123" width="264" height="269" rx="12" fill="currentColor" stroke="white" strokeWidth="6" />
        <circle cx="222" cy="258" r="76" fill="white" />
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x="219" y="192" width="6" height="15" rx="3" fill="currentColor" transform={`rotate(${i * 30} 222 258)`} />)}
        <circle cx="222" cy="258" r="44" fill="currentColor" />
        <circle cx="222" cy="258" r="32" fill="none" stroke="white" strokeWidth="6" />
        <rect x="326" y="218" width="9" height="81" rx="4.5" fill="white" />
      </g>
      <rect x="44" y="150" width="53" height="44" rx="12" fill="currentColor" stroke="white" strokeWidth="6" />
      <rect x="44" y="322" width="53" height="44" rx="12" fill="currentColor" stroke="white" strokeWidth="6" />
    </svg>
    <span className={styles.safeCaption} data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-1" : undefined}>YOUR WORLD. UNDER LOCK & KEY.</span>
  </div>;
}

export function VaultEntry() {
  const [demoOpen, setDemoOpen] = useState(false);
  const [openingDemo, setOpeningDemo] = useState(false);
  const [key, setKey] = useState("");
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    if (!openingDemo) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => { setDemoOpen(true); setOpeningDemo(false); setKey(""); }, reduced ? 0 : 1450);
    return () => clearTimeout(timer);
  }, [openingDemo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || openingDemo) return;
    if (!key.trim()) { setMessage("Enter a demo key to try the Vault."); input.current?.focus(); return; }
    const controller = new AbortController();
    pending.current = controller;
    setPhase("checking");
    setMessage("Checking demo key…");
    setAttempt(value => value + 1);
    try {
      const result = await validateMockVaultKey(key, controller.signal);
      if (controller.signal.aborted) return;
      if (result === "demo" && process.env.NODE_ENV === "development") {
        setPhase("success"); setOpeningDemo(true); setMessage("Opening demo Vault…"); return;
      }
      setPhase(result === "demo" ? "failure" : result);
      setMessage(result === "success" ? "Demo Vault opened. Nothing has been unlocked or stored." : "That demo key didn’t fit. Try OPEN to see the Vault open.");
    } catch {
      if (!controller.signal.aborted) { setPhase("idle"); setMessage("The preview couldn’t finish. Please try again."); }
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }

  if (demoOpen && process.env.NODE_ENV === "development") return <VaultDemo onLock={() => {
    setDemoOpen(false); setPhase("idle"); setKey(""); setMessage(""); setRotation(0);
    requestAnimationFrame(() => input.current?.focus());
  }} />;

  return <section className={styles.page} aria-labelledby="vault-title">
    <div className={styles.composition}>
      <div className={styles.dialWrap}><CombinationDial rotation={rotation} /></div>
      <div className={styles.content}>
        <p className={styles.eyebrow} data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-2" : undefined}>ZIK VAULT</p>
        <h1 id="vault-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-3" : undefined}>Your world.<br />Your <em>key.</em></h1>
        <p className={styles.intro} data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-4" : undefined}>A little privacy. A lot of possibility.<br />Unlock your Vault.</p>
        <form onSubmit={submit} className={styles.form} aria-busy={phase === "checking"}>
          <label htmlFor="vault-key" data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-5" : undefined}>Vault key</label>
          <div className={styles.inputRow}>
            <input ref={input} id="vault-key" type="text" value={key} maxLength={128} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="Enter your key" readOnly={phase === "checking" || openingDemo} aria-describedby="vault-demo vault-status" aria-invalid={phase === "failure" || undefined} onChange={event => {
              const next = event.target.value;
              setRotation(value => value + Math.max(1, Math.abs(next.length - key.length)) * 18);
              setKey(next); setPhase("idle"); setMessage("");
            }} />
            <button type="submit" disabled={phase === "checking" || openingDemo} aria-label="Unlock Vault">
              <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" /></svg>
            </button>
          </div>
          <p id="vault-status" role="status" aria-live="polite" aria-atomic="true" className={styles.status} data-error={phase === "failure"}>{message}</p>
          <p id="vault-demo" className={styles.demo}>Preview only. Try <strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-6" : undefined}>OPEN</strong> for success, or any other key for the alarm. Use a demo key, not a real credential.{process.env.NODE_ENV === "development" && <> Enter <strong data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-7" : undefined}>memaguy</strong> to explore the demo Vault.</>}</p>
        </form>
      </div>
      <Safe phase={phase} attempt={attempt} />
    </div>
    <p className={styles.footer} data-local-edit={process.env.NODE_ENV === "development" ? "ve-23054f094a27-8" : undefined}>A SPACE THAT’S SIMPLY YOURS.</p>
  </section>;
}
