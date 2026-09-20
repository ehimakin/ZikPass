"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/customer/ui";
type Options = { googleUrl: string; ics: string; filename: string; localOnly: boolean };
export function AffiliateCalendarActions({ id, credential, scope, status }: { id: string; credential: string; scope: "setup" | "pair"; status: string }) {
  const [options, setOptions] = useState<Options>(); const [error, setError] = useState(""); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setOptions(undefined); setError(""); if (status === "cancelled") return;
    const controller = new AbortController();
    fetch("/api/affiliate/booking", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}` }, body: JSON.stringify({ action: "calendar", id, scope }), signal: controller.signal, cache: "no-store" })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setOptions(data); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Calendar options unavailable."); });
    return () => controller.abort();
  }, [id, credential, scope, status, attempt]);
  function download() {
    if (!options) return;
    const url = URL.createObjectURL(new Blob([options.ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = options.filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  if (status === "cancelled") return <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-345aee9e612e-1" : undefined}>This booking is cancelled. Remove any manually added copy from your calendar.</p>;
  return <div className="space-y-3" aria-label="Calendar options">
    {error ? <><p role="alert" className="text-sm">{error}</p><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Retry calendar options</Button></> : !options ? <p className="text-sm" role="status" data-local-edit={process.env.NODE_ENV === "development" ? "ve-345aee9e612e-2" : undefined}>Loading calendar options…</p> : <>
      <div className="flex flex-wrap items-center gap-3"><a className="inline-flex min-h-[44px] items-center rounded-full border border-[var(--zk-line-strong)] px-5 text-sm font-semibold" href={options.googleUrl} target="_blank" rel="noreferrer" data-local-edit={process.env.NODE_ENV === "development" ? "ve-345aee9e612e-3" : undefined}>Add to Google Calendar</a><Button variant="secondary" onClick={download}>Apple Calendar (.ics)</Button></div>
      <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-345aee9e612e-4" : undefined}>Google opens an event for you to save. Open the .ics file in Apple Calendar, or use the email invitation on iPhone. Manual additions are copies; accept the email invitation for booking updates.</p>
      {status === "requested" && <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-345aee9e612e-5" : undefined}>The requested time still needs your agent’s confirmation.</p>}
      {options.localOnly && <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-345aee9e612e-6" : undefined}>The session link currently points to this computer’s development server. A public URL is needed to join remotely.</p>}
    </>}
  </div>;
}
