"use client";

import { useEffect, useRef, useState } from "react";
import { waitForIceGathering } from "@/lib/client/zik-id-peer";
import { parseZikIdPeerPayload, type ZikIdPeerPayload } from "@/lib/shared/zik-id";
import { verifyPresentationBundle } from "@/lib/shared/verifier-sdk";
import { ZikLogoMark } from "@/components/zik-logo";
import { Button, StatusBadge } from "@/components/customer/ui";

export function ZikIdVerifier({ sessionId, code, issuerPublicKey }: { sessionId: string; code: string; issuerPublicKey: JsonWebKey }) {
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState("Connecting directly to the customer’s device…");
  const [payload, setPayload] = useState<ZikIdPeerPayload>();
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    let disposed = false;
    let revealTimer: number | undefined;
    const peer = new RTCPeerConnection({ iceServers: [] }); peerRef.current = peer;
    const chunks: string[] = [];
    let expectedChunks = 0;
    let expectedChallenge = "";

    peer.ondatachannel = (event) => {
      const channel = event.channel;
      channel.onopen = () => { if (!disposed) setStatus("Secure direct connection ready. Waiting for Zik ID…"); };
      channel.onmessage = (message) => {
        void (async () => {
          const frame = JSON.parse(String(message.data)) as { type?: string; chunks?: number; index?: number; data?: string };
          if (frame.type === "zik-id-start") {
            if (!Number.isInteger(frame.chunks) || (frame.chunks ?? 0) < 1 || (frame.chunks ?? 0) > 40) throw new Error("Invalid direct presentation.");
            expectedChunks = frame.chunks!; chunks.length = 0; setStatus("Receiving selected fields directly…"); return;
          }
          if (frame.type === "zik-id-chunk") {
            if (!Number.isInteger(frame.index) || typeof frame.data !== "string" || frame.data.length > 12000 || frame.index !== chunks.length) throw new Error("Invalid direct presentation.");
            chunks.push(frame.data); return;
          }
          if (frame.type !== "zik-id-end" || chunks.length !== expectedChunks) return;
          const next = parseZikIdPeerPayload(JSON.parse(chunks.join("")));
          if (next.sessionId !== sessionId || next.presentation.challenge !== expectedChallenge || Math.abs(Date.now() - Date.parse(next.sharedAt)) > 30000) throw new Error("This Zik ID presentation does not match the one-time request.");
          const verification = await verifyPresentationBundle(next.presentation, issuerPublicKey, new Date());
          if (verification.decision !== "allow") throw new Error("The signed Zik Pass could not be verified.");
          if (disposed) return;
          setPayload(next); setRemaining(8); setStatus("Compare the photo with the person presenting this Zik ID.");
          revealTimer = window.setInterval(() => setRemaining((seconds) => {
            if (seconds > 1) return seconds - 1;
            if (revealTimer) window.clearInterval(revealTimer);
            setPayload(undefined); setStatus("Photo cleared. This one-time Zik ID has expired."); return 0;
          }), 1000);
        })().catch((error) => { if (!disposed) setStatus(error instanceof Error ? error.message : "Unable to verify this Zik ID."); });
      };
    };

    void (async () => {
      if (!sessionId || !code || !("RTCPeerConnection" in window)) throw new Error("This device cannot receive a direct Zik ID.");
      const response = await fetch(`/api/zik-id/sessions/${encodeURIComponent(sessionId)}?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const signal = await response.json() as { offer?: RTCSessionDescriptionInit; challenge?: string; expiresAt?: string; error?: string };
      if (!response.ok || !signal.offer || !signal.challenge) throw new Error(signal.error ?? "This Zik ID request is invalid or has expired.");
      expectedChallenge = signal.challenge;
      await peer.setRemoteDescription(signal.offer);
      const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); await waitForIceGathering(peer);
      const answerResponse = await fetch(`/api/zik-id/sessions/${encodeURIComponent(sessionId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, answer: peer.localDescription?.toJSON() }) });
      if (!answerResponse.ok) throw new Error(((await answerResponse.json()) as { error?: string }).error ?? "Unable to connect to this Zik ID.");
    })().catch((error) => { if (!disposed) setStatus(error instanceof Error ? error.message : "Unable to connect to this Zik ID."); });

    return () => { disposed = true; if (revealTimer) window.clearInterval(revealTimer); peer.close(); };
  }, [code, issuerPublicKey, sessionId]);

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[var(--zk-canvas)] px-4 py-6 text-[var(--zk-text)]">
      <header className="mb-6 flex items-center gap-2"><ZikLogoMark className="h-8 w-8"/><span className="font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e64ed15cdcfc-1" : undefined}><span className="text-[#28623c]">Zik</span> ID verifier</span><StatusBadge>Direct</StatusBadge></header>
      {payload ? <section className="overflow-hidden rounded-none border border-[#d3bb53] bg-[#fffdf5] shadow-xl"><div className="bg-[#28623c] px-5 py-4 text-white"><div className="flex items-center justify-between"><strong className="text-xl" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e64ed15cdcfc-2" : undefined}>18+ verified</strong><span className="rounded-full bg-white/15 px-3 py-1 text-sm">{remaining}s</span></div><p className="mt-1 text-sm text-white/75" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e64ed15cdcfc-3" : undefined}>Signed Zik Pass verified on this device</p></div><div className="space-y-5 p-5">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={payload.selfie} alt="Temporary designated photo of the Zik ID holder" className="aspect-square w-full rounded-none object-cover"/><div className="rounded-none bg-[#fff3bf] p-3 text-center font-bold text-[#5f4d00]">Compare this photo with the person in front of you</div><dl className="space-y-3">{payload.disclosed.legalName?<Field label="Legal name" value={payload.disclosed.legalName}/>:null}{payload.disclosed.deliveryAddress?<Field label="Delivery address" value={payload.disclosed.deliveryAddress}/>:null}{payload.disclosed.email?<Field label="Email" value={payload.disclosed.email}/>:null}</dl><Button variant="secondary" size="lg" onClick={()=>{setPayload(undefined);setRemaining(0);setStatus("Photo cleared by verifier.");}}>Clear now</Button></div></section> : <section className="grid min-h-[60vh] place-items-center rounded-none border border-[var(--zk-line)] bg-[var(--zk-card)] p-8 text-center"><div><div className="mx-auto mb-5 h-12 w-12 animate-pulse rounded-full bg-[var(--zk-positive-bg)]"/><h1 className="text-2xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e64ed15cdcfc-4" : undefined}>One-time Zik ID</h1><p role="status" className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">{status}</p><p className="mt-5 font-mono text-lg font-bold tracking-[0.18em]">{code}</p></div></section>}
      <p className="mt-5 text-xs leading-relaxed text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-e64ed15cdcfc-5" : undefined}>The photo and selected Vault fields arrive over an encrypted WebRTC connection. They are held in this page’s memory only and automatically cleared after eight seconds.</p>
    </main>
  );
}

function Field({label,value}:{label:string;value:string}) { return <div className="border-b border-[var(--zk-line)] pb-3"><dt className="text-xs font-semibold uppercase tracking-wide text-[var(--zk-text-faint)]">{label} · Self-entered</dt><dd className="mt-1 font-bold">{value}</dd></div>; }
