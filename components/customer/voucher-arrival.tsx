"use client";
import { useEffect, useState } from "react";
import { ZikLogoMark } from "@/components/zik-logo";
import { Alert, Button, ButtonLink, Card } from "@/components/customer/ui";

export function VoucherArrival() {
  const [arrival, setArrival] = useState<{ storeName: string } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    setError(""); setArrival(null);
    const token = new URLSearchParams(window.location.hash.slice(1)).get("activate");
    async function connect() {
      if (!token) { setError("Scan the QR on your clerk’s screen to begin."); return; }
      try {
        const response = await fetch("/api/purchase-sale/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) { setArrival(data); timer = setTimeout(connect, 5000); }
      } catch (reason) {
        if (active) { setArrival(null); setError(reason instanceof Error ? reason.message : "Connection interrupted. Please retry."); }
      }
    }
    void connect();
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  return <main className="zk-surface min-h-[100dvh] bg-[var(--zk-canvas)] px-5 py-10">
    <div className="mx-auto max-w-md space-y-8">
      <header className="flex items-center gap-3"><ZikLogoMark className="h-10 w-10" /><span className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-1" : undefined}>ZikPass</span><ButtonLink href="/dashboard" variant="ghost" className="ml-auto">Dashboard</ButtonLink></header>
      <div><p className="mb-2 text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-2" : undefined}>Your dashboard · Digital ZikPass</p><h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-3" : undefined}>Let’s get you connected.</h1></div>
      <div aria-live="polite">
        {error ? <Alert tone="caution" title="We couldn’t connect"><p>{error}</p><Button className="mt-4" onClick={() => setAttempt(value => value + 1)}>Try again</Button></Alert>
        : arrival ? <Card className="space-y-4 p-6"><span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-900" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-4" : undefined}>Connected to the counter</span><h2 className="text-xl font-bold">{arrival.storeName}</h2><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-5" : undefined}>Your clerk can now see that you’ve opened this session. Keep this page open.</p></Card>
        : <p role="status" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-6" : undefined}>Connecting to your clerk…</p>}
      </div>
      <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c824199fd7e0-7" : undefined}>Connection preview · This test stops at the handoff. Device authentication and pass activation are the next step; no pass has been issued.</p>
    </div>
  </main>;
}
