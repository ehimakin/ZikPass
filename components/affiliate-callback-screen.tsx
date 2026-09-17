"use client";
import { useEffect, useRef, useState } from "react";

export function AffiliateCallbackScreen({ code, state }: { code: string | null; state: string | null }) {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Avoid exchanging a one-time code twice under React Strict Mode.
    if (started.current) return;
    started.current = true;
    if (!code || !state) { window.location.replace("/affiliate-demo?verification=denied"); return; }
    void fetch("/api/affiliate-demo/complete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, state })
    }).then((response) => {
      window.location.replace(response.ok ? "/affiliate-demo" : "/affiliate-demo?verification=denied");
    }).catch(() => setFailed(true));
  }, [code, state]);
  return <section className="rounded-3xl bg-[#140f1c] p-8 text-white" aria-live="polite">
    <h1 className="text-2xl font-bold">{failed ? "Connection interrupted" : "Finishing your age check…"}</h1>
    {failed && <><p className="mt-4" data-local-edit={process.env.NODE_ENV === "development" ? "ve-37abde9ca2ad-1" : undefined}>Return to the age gate to check your status or try again.</p><a className="mt-5 inline-block underline" href="/affiliate-demo" data-local-edit={process.env.NODE_ENV === "development" ? "ve-37abde9ca2ad-2" : undefined}>Return to JerkMeat</a></>}
  </section>;
}
