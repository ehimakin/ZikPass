"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AffiliateCalendarActions } from "@/components/affiliate-calendar-actions";
import { Button, Card } from "@/components/customer/ui";
type Progress = { ended: boolean; role: "client" | "agent"; clientOnline: boolean; agentOnline: boolean; form: Record<string, string>; guidance: string; registration: { booking?: { startsAt: string; status: string; delivery: string }; name: string; website: string; callback: string; state: string; connectedAt?: string; verifiedAt?: string } };
const fields = { organisation: "Organisation", framework: "Website framework", contact: "Developer contact", implementation: "Installation progress", question: "What do you need help with?" };
const style = "mt-1 w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-3 text-sm";
export function AffiliatePairedSession() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const params = useSearchParams(); const id = params.get("id") ?? "";
  const [role, setRole] = useState<"client" | "agent">("client"); const [key, setKey] = useState(""); const [credential, setCredential] = useState("");
  const [session, setSession] = useState(""); const [progress, setProgress] = useState<Progress>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [guidance, setGuidance] = useState("");
  const [form, setForm] = useState<Record<string, string>>({}); const pending = useRef<Record<string, string>>({});
  const [saved, setSaved] = useState(true);
  useEffect(() => { try { const value = JSON.parse(sessionStorage.getItem(`zik-pair-${id}`) ?? "null"); if (value?.session) { setSession(value.session); setRole(value.role); } } catch {} }, [id]);
  const call = useCallback(async (action: string, auth: string, extra: object = {}) => {
    const response = await fetch("/api/affiliate/pair", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth}` }, body: JSON.stringify({ action, id, ...extra }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
  }, [id]);
  useEffect(() => {
    if (!session) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const patch = { ...pending.current };
        const data: Progress = await call("progress", session, Object.keys(patch).length ? { input: { form: patch } } : {});
        for (const [name, value] of Object.entries(patch)) if (pending.current[name] === value) delete pending.current[name];
        if (!stopped) setSaved(Object.keys(pending.current).length === 0);
        if (!stopped) { if (data.ended) { setSession(""); return; } setProgress(data); setForm(current => ({ ...data.form, ...pending.current, ...(Object.keys(pending.current).length ? current : {}) })); setError(""); }
      } catch (err) {
        if (!stopped) {
          const message = err instanceof Error ? err.message : "Connection interrupted. Reconnecting…";
          setError(message);
          if (message === "Join this session first." || message === "This paired session is unavailable or expired.") { sessionStorage.removeItem(`zik-pair-${id}`); setSession(""); setProgress(undefined); return; }
        }
      }
      if (!stopped) timer = setTimeout(poll, 2000);
    }
    void poll(); return () => { stopped = true; clearTimeout(timer); };
  }, [session, call, id]);
  async function join() {
    setBusy(true); setError("");
    try {
      let auth = credential;
      if (role === "client") { const setup = JSON.parse(sessionStorage.getItem("zik-affiliate-setup") ?? "null"); if (setup?.id !== id) throw new Error("Open your private setup invitation in this tab first, then return to this session."); auth = setup.token; }
      const result = await call("join", auth, { role, key }); setSession(result.session); setCredential(""); setKey(""); sessionStorage.setItem(`zik-pair-${id}`, JSON.stringify(result));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not join."); } finally { setBusy(false); }
  }
  function edit(field: string, value: string) {
    setForm(current => ({ ...current, [field]: value })); pending.current[field] = value; setSaved(false);

  }
  return <div className="space-y-5 py-5"><h1 className="text-3xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bb9d03001df-1" : undefined}>Set up together.</h1><p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bb9d03001df-2" : undefined}>Your agent can see the fields on this page and your installation checks. Credentials, identity documents and the rest of your screen are never shared.</p>
    {error && <p role="alert" className="text-sm text-[var(--zk-critical)]">{error}</p>}
    {!session ? <Card className="space-y-4 p-5"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void join(); }}>
      <label className="block text-sm">I am the<select aria-label="I am the" disabled={!ready} className={style} value={role} onChange={e => setRole(e.target.value as "client" | "agent")}><option value="client">Client</option><option value="agent">Zik agent</option></select></label>
      <label className="block text-sm">Shared pairing key<input disabled={!ready} className={style} type="password" value={key} onChange={e => setKey(e.target.value)} required autoComplete="off" /></label>
      {role === "agent" && <label className="block text-sm">Agent access key<input disabled={!ready} className={style} type="password" value={credential} onChange={e => setCredential(e.target.value)} required autoComplete="off" /></label>}
      <Button type="submit" loading={busy} disabled={!ready || !id}>Join paired session</Button>
    </form></Card> : progress && <>
      <Card className="space-y-3 p-5"><h2 className="text-xl font-bold">{progress.registration.name}</h2><p className="text-sm" role="status">Client {progress.clientOnline ? "connected" : "offline"} · Agent {progress.agentOnline ? "connected" : "offline"}</p><p className="break-all text-sm">{progress.registration.website}<br />Callback: {progress.registration.callback}</p><ul className="text-sm"><li>Connection: {progress.registration.connectedAt ? "verified" : "pending"}</li><li>Age-check exchange: {progress.registration.verifiedAt ? "received" : "pending"}</li><li>Integration: {progress.registration.state}</li></ul></Card>
      {progress.registration.booking && <Card className="space-y-3 p-5"><h2 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bb9d03001df-3" : undefined}>Walkthrough booking</h2><p className="text-sm">{new Date(progress.registration.booking.startsAt).toLocaleString()} · {progress.registration.booking.status}<br />Invitation delivery: {progress.registration.booking.delivery}</p><AffiliateCalendarActions id={id} credential={session} scope="pair" status={progress.registration.booking.status} />{role === "agent" && progress.registration.booking.status !== "cancelled" && <div className="flex flex-wrap gap-3">{(["confirmed", "cancelled"] as const).map(status => <Button key={status} variant="secondary" disabled={progress.registration.booking?.status === status} onClick={async () => { try { const response = await fetch("/api/affiliate/booking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` }, body: JSON.stringify({ action: "update", id, status }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setProgress(data); } catch (err) { setError(err instanceof Error ? err.message : "Booking update failed."); } }}>{status === "confirmed" ? "Confirm requested time" : "Cancel booking"}</Button>)}</div>}</Card>}
      <Card className="space-y-4 p-5"><h2 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bb9d03001df-4" : undefined}>Client setup form</h2>{Object.entries(fields).map(([field, label]) => <label className="block text-sm" key={field}>{label}<textarea aria-label={label} className={style} value={role === "agent" ? progress.form[field] ?? "" : form[field] ?? ""} onChange={e => edit(field, e.target.value)} readOnly={role === "agent"} maxLength={2000} /></label>)}{role === "client" && <p role="status" className="text-xs">{saved ? "Progress saved and shared with your agent." : "Saving progress…"}</p>}</Card>
      <Card className="space-y-3 p-5"><h2 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bb9d03001df-5" : undefined}>Agent guidance</h2>{role === "agent" ? <><textarea aria-label="Guidance for the client" className={style} value={guidance} onChange={e => setGuidance(e.target.value)} maxLength={2000} /><Button onClick={async () => { try { await call("progress", session, { input: { guidance } }); } catch (err) { setError(err instanceof Error ? err.message : "Could not send guidance."); } }}>Share guidance</Button></> : <p className="whitespace-pre-wrap text-sm">{progress.guidance || "Your agent’s guidance will appear here."}</p>}</Card>
      {role === "client" && <a className="inline-block font-semibold underline" href="/affiliates" target="_blank" data-local-edit={process.env.NODE_ENV === "development" ? "ve-7bb9d03001df-6" : undefined}>Open installation and credentials</a>}
      <Button variant="danger" onClick={async () => { try { await call("progress", session, { input: { end: true } }); sessionStorage.removeItem(`zik-pair-${id}`); setSession(""); setProgress(undefined); setError("Session ended. Enter your pairing key to rejoin."); } catch (err) { setError(err instanceof Error ? err.message : "Could not end session."); } }}>End shared session</Button>
    </>}
  </div>;
}
