"use client";

import { useEffect, useState } from "react";
import { JerkMeatSite } from "@/components/jerkmeat-site";
import styles from "./jerkmeat.module.css";

export function AffiliateDemoLanding({ verifiedUntil, denied = false }: { verifiedUntil: number | null; denied?: boolean }) {
  const [verified, setVerified] = useState(Boolean(verifiedUntil));
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(denied ? "Age verification was not completed. You can try again." : null);

  useEffect(() => {
    if (!verifiedUntil) { setVerified(false); return; }
    const update = () => setVerified(Date.now() < verifiedUntil);
    update();
    const timer = window.setTimeout(update, Math.max(0, verifiedUntil - Date.now()));
    window.addEventListener("focus", update);
    return () => { clearTimeout(timer); window.removeEventListener("focus", update); };
  }, [verifiedUntil]);

  async function startVerification() {
    if (starting) return;
    setStarting(true); setError(null);
    try {
      const response = await fetch("/api/affiliate-demo/start", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start verification.");
      window.location.assign(data.confirm_url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connection interrupted. Please retry.");
      setStarting(false);
    }
  }

  return <JerkMeatSite gate={<>
    {error && !verified && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.gateContent}>
      <div><h2>{verified ? "Good taste. Age verified." : "A little check before the main course."}</h2><p>{verified ? "Your check is still valid for JerkMeat. Continue straight to the kitchen." : "This food-only parody demonstrates an affiliate age gate. Verify with Zik to enter; your name, date of birth and ID stay off the menu."}</p></div>
      <div className={styles.gateActions}>{verified ? <>
        <p role="status" className={styles.goldStatus}><span aria-hidden="true">✓</span> Age verified with Zik</p>
        <a href="/affiliate-demo/continue" className={styles.pinkButton}>Continue / Log in</a>
      </> : <button type="button" disabled={starting} onClick={() => void startVerification()} className={styles.verifyButton}>{starting ? "Opening Zik…" : "Verify with Zik"}</button>}</div>
    </div>
  </>} />;
}
