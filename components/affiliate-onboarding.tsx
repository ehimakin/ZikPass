"use client";
import { useEffect, useState } from "react";
import { AffiliateCalendarActions } from "@/components/affiliate-calendar-actions";
import { Button, Card } from "@/components/customer/ui";

type Registration = { booking?: { startsAt: string; status: string; delivery: string }; id: string; name: string; website: string; callback: string; state: string; inviteExpiresAt: string; connectedAt?: string; verifiedAt?: string; assistance?: { email: string; requestedAt: string } };
const field = "mt-1 w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-3 text-sm";
export function AffiliateOnboarding() {
  const [ready, setReady] = useState(false);
  const [registration, setRegistration] = useState<Registration>();
  const [token, setToken] = useState(""); const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [name, setName] = useState(""); const [website, setWebsite] = useState(""); const [callback, setCallback] = useState("");
  const [email, setEmail] = useState(""); const [note, setNote] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [pair, setPair] = useState<{ id: string; key: string }>();
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setReady(true);
    setOrigin(location.origin);
    const hash = new URLSearchParams(location.hash.slice(1));
    const id = hash.get("setup"); const key = hash.get("key");
    if (id && key) {
      sessionStorage.setItem("zik-affiliate-setup", JSON.stringify({ id, token: key }));
      history.replaceState(null, "", location.pathname);
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem("zik-affiliate-setup") ?? "null");
      if (saved?.id && saved?.token) {
        setToken(saved.token);
        fetch(`/api/affiliate/onboarding?id=${encodeURIComponent(saved.id)}`, { headers: { Authorization: `Bearer ${saved.token}` }, cache: "no-store" })
          .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setRegistration(data.registration); })
          .catch(err => setError(err.message));
      }
    } catch { setError("Could not restore setup. Open your saved invitation link."); }
  }, []);
  async function act(action: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/affiliate/onboarding", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, id: registration?.id, name, website, callback, email, note }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRegistration(data.registration);
      if (data.token) { setToken(data.token); sessionStorage.setItem("zik-affiliate-setup", JSON.stringify({ id: data.registration.id, token: data.token })); }
      if (data.secret) setSecret(data.secret);
      if (action === "disable") setSecret("");
      if (action === "assistance") setNotice("Your setup request has been saved for the Zik operator. No appointment has been booked.");
      if (action === "activate") setNotice("Your development integration is active.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save setup."); }
    finally { setBusy(false); }
  }
  async function book() {
    setBusy(true); setError(""); setNotice("");
    try { const response = await fetch("/api/affiliate/booking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "request", id: registration?.id, email, startsAt: new Date(startsAt).toISOString() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setRegistration(data.registration); setPair(data.pair); setNotice(data.registration.booking.delivery === "sent" ? "Time requested. Email and calendar invitation submitted. Your agent still needs to confirm." : "Time requested and saved. Email/calendar delivery is not complete; see the booking status below."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not request booking."); } finally { setBusy(false); }
  }
  async function pairSetup() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/affiliate/pair", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "create", id: registration?.id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setPair(data); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create pair."); } finally { setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/affiliate/onboarding?id=${registration?.id}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setRegistration(data.registration);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not refresh setup."); }
    finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("Copied."); } catch { setError("Clipboard unavailable. Select and copy the text instead."); }
  }
  const setupLink = `${origin}/dashboard/affiliate#setup=${registration?.id}&key=${token}`;
  const env = `ZIK_ORIGIN=${origin}
ZIK_CLIENT_ID=${registration?.id}
ZIK_CLIENT_SECRET=${secret}
ZIK_REDIRECT_URI=${registration?.callback}
ZIK_SITE_ORIGIN=${registration?.website}`;
  return <div className="space-y-5">
    <p className="rounded-xl bg-[var(--zk-sunken)] p-3 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-1" : undefined}>Development environment · Real API requests with development credentials. This setup does not enable production access.</p>
    {error && <p role="alert" className="text-sm text-[var(--zk-critical)]">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!registration ? <Card className="p-5">
      <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-2" : undefined}>Start your site’s setup</h2>
      <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); void act("create"); }}>
        <label className="block text-sm">Site name<input className={field} value={name} onChange={e => setName(e.target.value)} required maxLength={100} autoComplete="organization" /></label>
        <label className="block text-sm">Website URL<input className={field} type="url" placeholder="http://localhost:3003" value={website} onChange={e => { setWebsite(e.target.value); if (!callback || callback === website.replace(/\/$/, "") + "/api/zik/callback") setCallback(e.target.value.replace(/\/$/, "") + "/api/zik/callback"); }} required /></label>
        <label className="block text-sm">Callback URL<input className={field} type="url" value={callback} onChange={e => setCallback(e.target.value)} required /></label>
        <p className="text-sm text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-3" : undefined}>Your server receives an over-18 result and its expiry after customer approval. Identity documents stay with Zik Pass. The callback must be on your site.</p>
        <Button type="submit" loading={busy} disabled={!ready}>Create setup link</Button>
      </form>
    </Card> : <>
      <Card className="space-y-4 p-5">
        <div><p className="text-xs uppercase tracking-widest">{registration.state} · Development</p><h2 className="mt-2 text-2xl font-bold">{registration.name}</h2><p className="break-all text-sm">{registration.website}</p></div>
        <h3 className="font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-4" : undefined}>Install yourself or send to your developer</h3>
        <p className="text-sm text-[var(--zk-text-soft)]">This private link resumes the same setup and lets its holder manage credentials. It expires {new Date(registration.inviteExpiresAt).toLocaleDateString()}. Share it only with your developer.</p>
        <input aria-label="Private setup link" className={field} value={setupLink} readOnly onFocus={e => e.target.select()} />
        <Button variant="secondary" onClick={() => void copy(setupLink)}>Copy developer handoff link</Button>
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-5" : undefined}>1. Add server credentials</h3>
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-6" : undefined}>Credentials are shown once. Save them in your server’s .env.local. Never use NEXT_PUBLIC_ or browser code. Generating a replacement invalidates the old credential and resets testing.</p>
        <Button variant="secondary" loading={busy} onClick={() => void act("credentials")}>{registration.state === "draft" ? "Generate development credentials" : "Replace development credentials"}</Button>
        {secret && <><pre className="overflow-x-auto rounded-xl bg-[var(--zk-sunken)] p-3 text-xs">{env}</pre><Button variant="secondary" onClick={() => void copy(env)}>Copy environment settings</Button></>}
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-7" : undefined}>2. Install and verify</h3>
        <p className="text-sm">Pomography and JerkMeat already have the integration: add the settings above to .env.local, keep their independent session secret, restart the app, then run <code>npm run zik:check</code>.</p>
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-8" : undefined}>For another Next.js App Router site, download and review the installer. It previews every file and refuses to overwrite existing code.</p>
        <a className="inline-block font-semibold underline" href="/integrations/zik-next-setup.mjs" download data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-9" : undefined}>Download Next.js installer</a>
        <pre className="overflow-x-auto rounded-xl bg-[var(--zk-sunken)] p-3 text-xs">{`node zik-next-setup.mjs
node zik-next-setup.mjs --install
node --env-file=.env.local zik-next-setup.mjs --check`}</pre>
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-10" : undefined}>The installer includes a verification button and a server-side access guard. Your developer must apply that guard to protected pages and APIs. Then complete an age check from your site with a valid development pass.</p>
        <a className="inline-block underline" href="/integrations/README.md" target="_blank" rel="noreferrer" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-11" : undefined}>Read installation and API instructions</a>
        <ul className="space-y-2 text-sm" aria-label="Integration progress">
          <li>{registration.connectedAt ? "✓" : "○"} Server connection {registration.connectedAt ? "verified" : "pending"}</li>
          <li>{registration.verifiedAt ? "✓" : "○"} Successful code exchange {registration.verifiedAt ? "received" : "pending"}</li>
          <li>{registration.state === "active" ? "✓" : "○"} Development activation</li>
        </ul>
        <div className="flex flex-wrap gap-3"><Button variant="secondary" loading={busy} onClick={() => void refresh()}>Refresh checks</Button><Button loading={busy} disabled={registration.state !== "testing" || !registration.connectedAt || !registration.verifiedAt} onClick={() => void act("activate")}>Activate development integration</Button></div>
        {registration.state !== "disabled" && <Button variant="danger" loading={busy} onClick={() => void act("disable")}>Disable new verifications</Button>}
        <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-12" : undefined}>Disabling stops new requests and exchanges. Existing affiliate sessions expire on their own, within 30 minutes in the supplied integration.</p>
      </Card>
      <Card className="space-y-4 p-5">
        <h3 className="text-lg font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-13" : undefined}>Set it up with me</h3>
        <Button variant="secondary" loading={busy} onClick={() => void pairSetup()}>Create paired session</Button>
        {pair && <div className="space-y-3"><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-14" : undefined}>Share this pairing key privately with your agent. Creating another session disconnects the previous pair.</p><input className={field} aria-label="Pairing key" value={pair.key} readOnly onFocus={e => e.target.select()} /><a className="inline-block underline" href={`/dashboard/affiliate/session?id=${pair.id}`} data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-15" : undefined}>Enter paired onboarding</a></div>}
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b84e95e7a26-16" : undefined}>Request a 30-minute walkthrough. Your agent confirms the time; this does not check their calendar availability.</p>
        {registration.booking && registration.booking.status !== "cancelled" ? <p role="status" className="text-sm">{new Date(registration.booking.startsAt).toLocaleString()} · {registration.booking.status}. Email/calendar: {registration.booking.delivery === "not_configured" ? "Sending connection or public session URL is not configured. Nothing has been sent." : registration.booking.delivery === "failed" ? "Delivery failed or is uncertain. Contact your agent; do not assume an invitation arrived." : registration.booking.delivery}.</p> : <form className="space-y-3" onSubmit={e => { e.preventDefault(); void book(); }}><label className="block text-sm">Booking contact email<input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label><label className="block text-sm">Requested date and time (your local time)<input className={field} type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} required /></label><Button type="submit" loading={busy}>Request a time and calendar invitation</Button></form>}
        {registration.booking && <AffiliateCalendarActions id={registration.id} credential={token} scope="setup" status={registration.booking.status} />}
        {registration.assistance && <p className="text-sm">Request saved for {registration.assistance.email}.</p>}
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act("assistance"); }}><label className="block text-sm">Contact email<input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></label><label className="block text-sm">What would you like help with?<textarea className={field} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></label><Button type="submit" loading={busy}>Request assisted setup</Button></form>
      </Card>
      <Button variant="ghost" onClick={() => { sessionStorage.removeItem("zik-affiliate-setup"); setRegistration(undefined); setToken(""); setSecret(""); setError(""); setNotice(""); }}>Set up another site</Button>
    </>}
  </div>;
}
