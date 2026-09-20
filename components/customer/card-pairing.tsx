"use client";
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card } from './ui';
import { CARD_STAGE_LABELS, type CardSessionView } from '@/lib/shared/card-activation';
import { cardRequest } from '@/lib/client/card-activation';
export function CardPairing() {
  const [token, setToken] = useState('');
  const [mockPublicKey, setKey] = useState('');
  const [session, setSession] = useState<CardSessionView | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const revision = useRef(0);
  const [error, setError] = useState('');
  useEffect(() => {
    // Random identifier only: NOT a keypair, proof of possession or hardware identifier.
    try {
      const key = sessionStorage.getItem('zik-card-demo-device') ?? `demo-public-key:${crypto.randomUUID?.() ?? "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === "x" ? n : (n & 3) | 8).toString(16); })}`;
      sessionStorage.setItem('zik-card-demo-device', key); setKey(key);
      const supplied = new URLSearchParams(location.hash.slice(1)).get('token');
      setToken(supplied ?? sessionStorage.getItem('zik-card-demo-token') ?? '');
      if (supplied) history.replaceState(null, '', location.pathname);
    } catch { setError('This demo needs browser session storage. Enable it and reload.'); }
  }, []);
  async function act(action: string) {
    if (pending.current) return;
    revision.current++;
    pending.current = true; setBusy(true); setError('');
    try {
      const value = await cardRequest({ action, token: token.trim(), mockPublicKey });
      setSession(value);
      sessionStorage.setItem('zik-card-demo-token', token.trim());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to connect.'); }
    finally { pending.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (!session || ['completed', 'expired', 'cancelled'].includes(session.stage)) return;
    let live = true;
    const timer = setInterval(() => {
      if (pending.current) return;
      const version = revision.current;
      void cardRequest({ action: 'customer_status', token: token.trim(), mockPublicKey }).then(value => { if (live && !pending.current && version === revision.current) setSession(value); }).catch(() => { if (live) setError('Connection interrupted. Retrying automatically.'); });
    }, 2000);
    return () => { live = false; clearInterval(timer); };
  }, [session, token, mockPublicKey]);
  return <div className="space-y-5 py-5">
    <h1 className="text-2xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5669ead57b00-1" : undefined}>Connect to your Zik Card</h1>
    <Alert tone="caution" title="Development demo">This records a mock public-key association only. It does not issue a pass or securely bind your device. No photo ID images, facial data or hardware identifiers are collected.</Alert>
    {error ? <p role="alert" className="text-red-800">{error}</p> : null}
    {!session ? <Card className="p-5"><form className="space-y-4" onSubmit={event => { event.preventDefault(); void act('pair'); }}>
      <label htmlFor="pair-code" className="block font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5669ead57b00-2" : undefined}>Pairing code from the clerk</label>
      <input id="pair-code" className="min-h-12 w-full rounded border p-3" value={token} maxLength={64} autoComplete="off" spellCheck={false} onChange={e => setToken(e.target.value.replace(/\s/g, ''))} required />
      <Button type="submit" disabled={!mockPublicKey} loading={busy}>Connect this demo device</Button>
    </form></Card> : <Card className="space-y-4 p-5">
      <p className="font-mono">{session.serial}</p><h2 className="text-xl font-bold" aria-live="polite">{CARD_STAGE_LABELS[session.stage]}</h2>
      {session.stage === 'device_connected' ? <><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-5669ead57b00-3" : undefined}>The Zik Pass age check and payment were completed at card purchase (assumed in this demo). Confirm to associate that purchase verification with this demo device.</p><Button disabled={busy} onClick={() => void act('customer_bind')}>Bind verification to this device (demo)</Button></> : null}

      {session.stage === 'completed' ? <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-5669ead57b00-4" : undefined}>Demo complete. No production credential or secure device binding has been created.</p> : null}
      {['completed', 'expired', 'cancelled'].includes(session.stage) ? <Button variant="secondary" onClick={() => { setSession(null); setToken(''); sessionStorage.removeItem('zik-card-demo-token'); }}>Enter another pairing code</Button> : null}
    </Card>}
  </div>;
}
