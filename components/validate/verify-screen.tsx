'use client';
import { useEffect, useState } from 'react';
import { Button, StatusBadge } from '@/components/customer/ui';
import { fingerprint, listRecords, type ValidationRecord } from '@/lib/validate/model';
import { ValidationDetails } from './validation-record';
export function VerifyScreen() {
  const [id, setId] = useState('');
  const [record, setRecord] = useState<ValidationRecord | null>(null);
  const [message, setMessage] = useState('');
  const [match, setMatch] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setId(new URLSearchParams(window.location.search).get('id') ?? ''); }, []);
  return <div className="space-y-6 py-5">
    <StatusBadge>Public verification concept · Local prototype</StatusBadge>
    <h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2c14ad7bd222-1" : undefined}>Check an attestation.</h1>
    <p className="text-sm leading-relaxed" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2c14ad7bd222-2" : undefined}>Find who made an attestation, what they confirmed and when. Only records completed in this browser are recognised. There is no public registry or authenticated professional signature in this demo.</p>
    <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setRecord(null); setMatch(null); setMessage('');
      try { const found = (await listRecords()).find(r => r.id === id.trim().toUpperCase() && r.status === 'validated'); setRecord(found ?? null); if (!found) setMessage('No completed validation found in this browser. Check the ID or complete a prototype request first.'); }
      catch { setMessage('Unable to read local prototype records. Browser storage may be unavailable.'); }
      finally { setBusy(false); }
    }}><label className="block text-sm font-semibold">Zik Validation ID<input className="mt-2 w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-4" disabled={busy} value={id} onChange={e => { setId(e.target.value); setRecord(null); setMatch(null); setMessage(''); }} placeholder="ZV-…" required /></label><Button type="submit" loading={busy}>Check validation</Button></form>
    {message && <p role="status">{message}</p>}
    {record && <><h2 className="text-2xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2c14ad7bd222-3" : undefined}>Validation confirmed ✓</h2><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2c14ad7bd222-4" : undefined}>Zik Validation ID recognised in local prototype data. This demonstrates record lookup; it does not establish that an attestation is genuine or that its statement is true.</p><ValidationDetails record={record} /><label className="block rounded-2xl bg-[var(--zk-sunken)] p-5 text-sm font-semibold">Compare a document fingerprint<input key={record.id} type="file" aria-label="Compare document" className="mt-3 block w-full" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; setMatch(null); if (!file) return;
      if (file.size > 20 * 1024 * 1024) { setMessage('Choose a document up to 20 MB.'); return; }
      setBusy(true); setMessage('');
      try { setMatch(await fingerprint(file) === record.documentHash); } catch { setMessage('Could not calculate the document fingerprint.'); } finally { setBusy(false); }
    }} /></label><p role="status" className="font-semibold">{match === null ? 'Document not compared yet.' : match ? 'Document unchanged · Fingerprint matches ✓' : 'Document differs · Fingerprint does not match'}</p></>}
  </div>;
}
