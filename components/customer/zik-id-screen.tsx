"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { VaultSession } from "@/lib/client/vault-adapter";
import { createPresentationBundle, loadWalletState } from "@/lib/client/wallet-client";
import { performPlatformUserVerification, sendChunkedJson, waitForIceGathering } from "@/lib/client/zik-id-peer";
import type { VaultProfileV1 } from "@/lib/shared/vault";
import type { ZikIdDisclosedFields, ZikIdPeerPayload } from "@/lib/shared/zik-id";
import type { WalletState } from "@/lib/shared/types";
import { Alert, Button, ButtonLink, Card, StatusBadge } from "@/components/customer/ui";

type SignalResponse = { sessionId: string; code: string; challenge: string; expiresAt: string; verifyUrl: string };

export function ZikIdScreen() {
  const vault = useRef(new VaultSession());
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const pollRef = useRef<number | undefined>(undefined);
  const [wallet, setWallet] = useState<WalletState>();
  const [vaultExists, setVaultExists] = useState<boolean>();
  const [profile, setProfile] = useState<VaultProfileV1>();
  const [passphrase, setPassphrase] = useState("");
  const [includeName, setIncludeName] = useState(true);
  const [includeAddress, setIncludeAddress] = useState(false);
  const [includeEmail, setIncludeEmail] = useState(false);
  const [signal, setSignal] = useState<SignalResponse>();
  const [qr, setQr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Unlock your Vault to build a Zik ID.");

  useEffect(() => {
    void Promise.all([loadWalletState(), vault.current.exists()]).then(([nextWallet, exists]) => { setWallet(nextWallet); setVaultExists(exists); });
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      peerRef.current?.close();
      vault.current.lock();
    };
  }, []);

  async function unlockVault() {
    setBusy(true); setStatus("Unlocking your device Vault…");
    try {
      await vault.current.unlock(passphrase); setPassphrase("");
      const next = vault.current.read(); setProfile(next);
      setStatus(next.selfie ? "Choose what this one-time Zik ID will disclose." : "Add a designated selfie to your Vault before presenting Zik ID.");
    } catch { setPassphrase(""); setStatus("Unable to unlock. Check your passphrase."); }
    finally { setBusy(false); }
  }

  async function prepareId() {
    if (!profile?.selfie || !wallet?.credential) return;
    setBusy(true); setStatus("Confirm with Face ID, fingerprint or your device passcode.");
    try {
      await performPlatformUserVerification();
      setStatus("Preparing a private direct connection…");
      const peer = new RTCPeerConnection({ iceServers: [] });
      peerRef.current?.close(); peerRef.current = peer;
      const channel = peer.createDataChannel("zik-id", { ordered: true });
      const offer = await peer.createOffer(); await peer.setLocalDescription(offer); await waitForIceGathering(peer);
      const response = await fetch("/api/zik-id/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer: peer.localDescription?.toJSON() }) });
      const data = await response.json() as SignalResponse | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error ?? "Unable to create Zik ID request.");
      const nextSignal = data as SignalResponse; setSignal(nextSignal);
      setQr(await QRCode.toDataURL(nextSignal.verifyUrl, { width: 420, margin: 2, color: { dark: "#0e1726", light: "#ffffff" } }));
      setStatus("Ask the bouncer to scan this one-time code.");

      let sent = false;
      channel.onopen = () => {
        if (sent) return; sent = true;
        void (async () => {
          const disclosed: ZikIdDisclosedFields = {
            over18: true,
            ...(includeName ? { legalName: profile.legal_name.value } : {}),
            ...(includeAddress ? { deliveryAddress: profile.delivery_address.value } : {}),
            ...(includeEmail && profile.email ? { email: profile.email.value } : {})
          };
          const payload: ZikIdPeerPayload = { version: 1, sessionId: nextSignal.sessionId, sharedAt: new Date().toISOString(), selfie: profile.selfie!.data_url, disclosed, presentation: await createPresentationBundle(nextSignal.challenge) };
          await sendChunkedJson(channel, payload);
          setStatus("Zik ID shared directly. The verifier can view it only briefly.");
          setBusy(false);
          window.setTimeout(() => {
            void fetch(`/api/zik-id/sessions/${encodeURIComponent(nextSignal.sessionId)}?code=${encodeURIComponent(nextSignal.code)}`, { method: "DELETE" });
            channel.close(); peer.close();
          }, 1500);
        })().catch((error) => { setStatus(error instanceof Error ? error.message : "Unable to share Zik ID."); setBusy(false); });
      };

      const poll = async () => {
        const result = await fetch(`/api/zik-id/sessions/${encodeURIComponent(nextSignal.sessionId)}?code=${encodeURIComponent(nextSignal.code)}`, { cache: "no-store" });
        if (!result.ok) return;
        const current = await result.json() as { answer?: RTCSessionDescriptionInit };
        if (current.answer && peer.signalingState === "have-local-offer") {
          await peer.setRemoteDescription(current.answer);
          if (pollRef.current) window.clearInterval(pollRef.current);
          setStatus("Bouncer connected. Sharing only your selected Zik ID fields…");
        }
      };
      pollRef.current = window.setInterval(() => void poll().catch(() => {}), 800);
      void poll();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to prepare Zik ID."); setBusy(false);
    }
  }

  if (wallet && !wallet.credential) return <Alert tone="caution" title="A Zik Pass is required" action={<ButtonLink href="/pass">Open My Pass</ButtonLink>}>Zik ID pairs selected Vault fields with your signed over-18 credential.</Alert>;
  if (vaultExists === false) return <Alert tone="caution" title="Create your Vault first" action={<ButtonLink href="/vault">Open Zik Vault</ButtonLink>}>Your designated selfie and optional identity fields stay encrypted in your device Vault.</Alert>;

  return (
    <div className="space-y-5">
      <div><div className="flex items-center gap-2"><h1 className="text-2xl font-extrabold">Present Zik ID</h1><StatusBadge>Peer-to-peer</StatusBadge></div><p className="mt-2 text-sm text-[var(--zk-text-soft)]">Build a one-time bar ID from your device Vault. Zik carries connection details only—the selfie and selected fields do not pass through Zik servers.</p></div>

      {!profile ? <Card className="space-y-4 p-5"><label className="block text-sm font-semibold">Vault passphrase<input type="password" minLength={12} maxLength={1024} value={passphrase} onChange={(event)=>setPassphrase(event.target.value)} className="mt-1 w-full rounded-lg border p-3" autoComplete="off"/></label><Button onClick={()=>void unlockVault()} loading={busy} disabled={passphrase.length<12}>Unlock Vault</Button></Card> : !profile.selfie ? <Alert tone="caution" title="Choose a designated selfie" action={<ButtonLink href="/vault">Add selfie in Vault</ButtonLink>}>The photo must be selected and encrypted on this device before Zik ID can be used.</Alert> : (
        <>
          <Card className="space-y-4 p-5"><div className="flex items-center gap-4">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={profile.selfie.data_url} alt="Your designated Zik ID selfie" className="h-24 w-24 rounded-2xl object-cover"/><div><p className="font-bold">Designated selfie</p><p className="mt-1 text-xs text-[var(--zk-text-soft)]">Encrypted in this device Vault</p></div></div><fieldset className="space-y-3"><legend className="font-bold">Share for this check</legend><CheckedRow label="Over 18" note="Zik verified · required" checked disabled/><CheckedRow label="Legal name" note="Self-entered" checked={includeName} onChange={setIncludeName}/><CheckedRow label="Delivery address" note="Self-entered" checked={includeAddress} onChange={setIncludeAddress}/>{profile.email?<CheckedRow label="Email" note="Self-entered" checked={includeEmail} onChange={setIncludeEmail}/>:null}</fieldset></Card>
          {!signal ? <Button size="lg" loading={busy} onClick={()=>void prepareId()}>Authenticate and create one-time ID</Button> : <Card className="space-y-3 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--zk-text-soft)]">Bouncer scans this</p>{qr?/* eslint-disable-next-line @next/next/no-img-element */<img src={qr} alt="One-time Zik ID QR code" className="mx-auto w-full max-w-[280px] rounded-xl"/>:null}<p className="font-mono text-2xl font-bold tracking-[0.18em]">{signal.code}</p><p className="text-xs text-[var(--zk-text-soft)]">Expires {new Date(signal.expiresAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</p><a href={signal.verifyUrl} className="text-sm font-semibold underline">Open verifier on this device</a></Card>}
        </>
      )}
      <p role="status" aria-live="polite" className="rounded-xl bg-[var(--zk-sunken)] p-3 text-sm">{status}</p>
      <p className="text-xs leading-relaxed text-[var(--zk-text-faint)]">WebRTC encrypts the direct device-to-device transfer. Connection signaling can expose network metadata such as IP addresses to the paired devices. No browser API can invoke AirDrop, and Web NFC is not consistently available on iPhone.</p>
    </div>
  );
}

function CheckedRow({label,note,checked,disabled,onChange}:{label:string;note:string;checked:boolean;disabled?:boolean;onChange?:(checked:boolean)=>void}) {
  return <label className="flex items-center gap-3 rounded-xl bg-[var(--zk-sunken)] p-3"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event)=>onChange?.(event.target.checked)} className="h-5 w-5 accent-[#28623c]"/><span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-[var(--zk-text-soft)]">{note}</span></span></label>;
}
