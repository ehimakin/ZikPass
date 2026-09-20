"use client";
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { OperatorShell } from './operator-shell';
import { CardScanner } from './card-scanner';
import { Alert, Button, Card } from '@/components/customer/ui';
import { CARD_STAGE_LABELS, parseCardSerial, type CardSessionView } from '@/lib/shared/card-activation';

import { cardRequest } from "@/lib/client/card-activation";
export function CardActivation({ storeId }: { storeId: string }) {
  const [serial, setSerial] = useState('');
  const [session, setSession] = useState<CardSessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const revision = useRef(0);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const storageKey = `zik-card-clerk:${storeId}`;
  async function act(action: string, payload?: string) {
    if (busyRef.current) return;
    revision.current++;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const next = await cardRequest({ action, id: session?.id, ...(action === 'start' ? { serial: parseCardSerial(payload ?? serial) } : {}) });
      setSession(next);
      try { sessionStorage.setItem(storageKey, next.id); } catch { /* optional reconnect convenience */ }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Service unavailable.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => {
    let live = true;
    let saved: string | null = null;
    try { saved = sessionStorage.getItem(storageKey); } catch { /* unavailable */ }
    if (saved) void cardRequest({ action: 'status', id: saved }).then(value => { if (live) setSession(value); }).catch(() => { if (live) setError('Previous session unavailable. Scan the card again to check its state.'); });
    return () => { live = false; };
  }, [storageKey]);
  const id = session?.id;
  const terminal = session && ['completed', 'cancelled', 'expired'].includes(session.stage);
  useEffect(() => {
    if (!id || terminal) return;
    let live = true;
    const timer = setInterval(() => {
      if (busyRef.current) return;
      const version = revision.current;
      void cardRequest({ action: 'status', id }).then(value => { if (live && !busyRef.current && version === revision.current) setSession(value); }).catch(() => { if (live) setError('Connection interrupted. Progress will reconnect automatically.'); });
    }, 2000);
    return () => { live = false; clearInterval(timer); };
  }, [id, terminal]);
  useEffect(() => {
    let live = true; setQr('');
    if (session?.token && !terminal) {
      const link = `${window.location.origin}/card/pair#token=${encodeURIComponent(session.token)}`;
      void QRCode.toDataURL(link, { width: 300, margin: 2 }).then(value => { if (live) setQr(value); }).catch(() => { if (live) setError('QR could not be displayed. Use the pairing code.'); });
    }
    return () => { live = false; };
  }, [session?.token, terminal]);
  function reset() { setSession(null); setSerial(''); setError(''); try { sessionStorage.removeItem(storageKey); } catch { /* optional */ } }
  return <OperatorShell title="Activate Zik Card" storeId={storeId}>
    <div className="space-y-5">
      <Alert tone="caution" title="Development demo only">No payment, credential issuance or secure device binding. The device association is a mock public-key reference. Use fictional cards and test participants only.</Alert>
      {error ? <p role="alert" className="text-red-800">{error}</p> : null}
      {!session ? <Card className="space-y-5 p-5">
        <CardScanner disabled={busy} onScan={value => { setSerial(value); void act('start', value); }} />
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void act('start'); }}>
          <label htmlFor="card-serial" className="block font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-1" : undefined}>Card serial or QR payload</label>
          <input id="card-serial" className="min-h-12 w-full rounded border p-3" value={serial} maxLength={80} autoComplete="off" spellCheck={false} onChange={event => setSerial(event.target.value)} placeholder="ZKC-DEMO-000001" required />
          <Button type="submit" loading={busy}>Check card and start onboarding</Button>
        </form>
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-2" : undefined}>Demo cards: ZKC-DEMO-000001 through ZKC-DEMO-000100. Public serials are not pairing codes.</p>
      </Card> : <Card className="space-y-5 p-5">
        <p className="font-mono">{session.serial}</p>
        <h2 className="text-xl font-bold" aria-live="polite">{CARD_STAGE_LABELS[session.stage]}</h2>
        {session.simulated ? <p className="font-semibold text-amber-800" data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-3" : undefined}>Simulated customer connection</p> : null}
        {!terminal ? <>
          <p className="text-sm">Expires at {new Date(session.expiresAt).toLocaleTimeString()}. The customer pairing QR follows the additional-services placeholder.</p>
          {session.stage === 'awaiting_customer' ? <div className="space-y-3">
            <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-4" : undefined}>Customer: scan this QR, or open /card/pair on the same server and enter the pairing code.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} width={300} height={300} className="mx-auto max-w-full" alt="Customer demo onboarding QR" /> : null}
            <p className="text-center">Pairing code: <strong className="break-all font-mono text-xl">{session.pairingCode}</strong></p>
            <Button variant="secondary" disabled={busy} onClick={() => void act('simulate_pair')}>Simulate customer pairing (development only)</Button>
          </div> : null}
          {session.stage === 'additional_services' ? <section className="space-y-4 rounded-lg border p-4" aria-labelledby="future-documents-title">
            <p className="font-semibold text-green-800" data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-5" : undefined}>Zik Pass age check and payment completed at card purchase.</p>
            <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-6" : undefined}>Demo assumption from the card registry; this prototype does not check a real purchase record.</p>
            <h3 id="future-documents-title" className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-7" : undefined}>Future in-person document verification</h3>
            <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-8" : undefined}>Additional documents will be verified here as a separate service from Zik Pass.</p>
            <div className="space-y-2 border-l-2 pl-3"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-9" : undefined}>Document verification — coming later</p><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-10" : undefined}>Separate payment gateway — placeholder only; no charge or payment details collected.</p></div>
            <Button disabled={busy} onClick={() => void act('show_qr')}>Continue to customer QR</Button>
          </section> : null}
          {session.stage === 'device_connected' ? <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-a5cf3286a110-11" : undefined}>Waiting for the customer to confirm binding on their phone. No repeat age check or Zik Pass payment is required.</p> : null}
          {session.simulated && session.stage === 'device_connected' ? <Button disabled={busy} onClick={() => void act('simulate_bind')}>Simulate customer binding confirmation</Button> : null}
          <Button variant="secondary" disabled={busy} onClick={() => void act('cancel')}>Cancel session</Button>
        </> : <><p>{session.stage === 'completed' ? 'Demo activation complete. The mock association is recorded; no usable credential or secure binding was created.' : 'This session cannot activate a card. Its pairing code is no longer usable.'}</p><Button onClick={reset}>Activate another card</Button></>}
      </Card>}
    </div>
  </OperatorShell>;
}
