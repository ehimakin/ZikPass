'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Card, StatusBadge } from '@/components/customer/ui';
import { canAttest, ValidationPolicyError, fingerprint, listRecords, requirements, saveRequest, transition, verifiers, type ValidationRecord, type ValidationType } from '@/lib/validate/model';
import { declineReasons, eligibility, resolvePolicy, type DeclineReason, type RequirementContext } from '@/lib/validate/policy';
import { PolicyContext, emptyContext } from './policy-context';
import { PolicySummary } from './policy-summary';
import { ValidationDetails } from './validation-record';
import { ValidationWorkflow } from './workflow';

const field = 'w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-4';
export function ValidateScreen() {
  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<'customer' | 'verifier'>('customer');
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ValidationType | 'Not sure' | ''>('');
  const [context, setContext] = useState<RequirementContext>(emptyContext);
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason | ''>('');
  const [verifierId, setVerifierId] = useState('');
  const [activeId, setActiveId] = useState('');
  const [ack, setAck] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const record = records.find(r => r.id === activeId) ?? records[0];
  const resolution = resolvePolicy(context, type || 'Not sure');
  const policy = resolution.status === 'matched' ? resolution.policy : null;
  const validationType: ValidationType = policy?.validationType ?? (type === 'Not sure' || !type ? 'Certified copy' : type);
  const refresh = useCallback(async () => { setRecords(await listRecords()); }, []);
  useEffect(() => {
    void refresh().catch(() => setError('Browser storage is unavailable. Enable local storage to use this prototype.')).finally(() => setReady(true));
    const sync = () => { void refresh().catch(() => setError('Could not reload local requests.')); };
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, [refresh]);
  useEffect(() => { setAck(false); setAttesting(false); setPreview(''); setEvidenceIds([]); setDeclining(false); setDeclineReason(''); }, [view, record?.id]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await action(); } catch (error) { setError(error instanceof ValidationPolicyError ? error.message : 'Could not complete this action. Check browser storage and try again.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function chooseFile(next: File | undefined) {
    setError(''); setFile(null);
    if (!next) return;
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(next.type) || next.size === 0 || next.size > 20 * 1024 * 1024) {
      setError('Choose a non-empty PDF, PNG, JPEG or WebP up to 20 MB.'); return;
    }
    setFile(next);
  }
  async function submit() {
    if (!file || !type || !policy || !verifiers.some(v => v.id === verifierId && eligibility(policy, v).eligible)) return;
    await run(async () => {
      const next: ValidationRecord = { id: `ZV-${crypto.randomUUID().toUpperCase()}`, documentName: file.name, documentHash: await fingerprint(file), validationType, validationStatement: policy.statement, policy, customer: 'Jamie Taylor · Fictional customer', verifierId, status: 'awaiting_verifier', createdAt: new Date().toISOString(), file };
      await saveRequest(next); setActiveId(next.id); await refresh(); setStep(0); setFile(null);
    });
  }
  function receipt() {
    if (!record) return;
    const { file: omitted, ...details } = record;
    void omitted;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ notice: 'Demonstrative receipt only. No legal certification or professional signature.', ...details, verifier: verifiers.find(v => v.id === record.verifierId) }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${record.id}-prototype-receipt.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="space-y-6 pb-8">
    <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge>Local prototype · Fictional data only</StatusBadge><Button variant="ghost" onClick={() => setView(view === 'customer' ? 'verifier' : 'customer')}>{view === 'customer' ? 'Switch to verifier view' : 'Return to customer'}</Button></div>
    <p className="text-xs leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-1" : undefined}>Documents stay in this browser. Professional status, eligibility and attestations are simulated. This is not legal certification.</p>
    {error && <p role="alert" className="rounded-xl bg-[var(--zk-critical-bg)] p-4 text-sm">{error}</p>}
    {!ready ? <p role="status" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-2" : undefined}>Loading local requests…</p> : view === 'customer' && step > 0 ? <>
      <p className="text-xs font-bold uppercase tracking-widest">Step {step} of 4 · {['', 'Upload', 'Validation type', 'Requirement', 'Choose verifier'][step]}</p>
      {step === 1 && <><h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-3" : undefined}>Upload document</h1><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-4" : undefined}>Use a dummy document to try the workflow.</p><label className={`${field} block`}>PDF or image · Up to 20 MB<input aria-label="Document upload" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => chooseFile(e.target.files?.[0])} className="mt-3 block w-full text-sm" /></label>{file && <Card className="break-words p-5"><p className="font-bold">{file.name}</p><p className="text-sm">{Math.ceil(file.size / 1024)} KB · Selected document</p></Card>}<Button disabled={!file} onClick={() => setStep(2)}>Continue →</Button></>}
      {step === 2 && <><h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-5" : undefined}>What do you need?</h1><PolicyContext value={context} onChange={next => { setContext(next); setVerifierId(''); }} /><fieldset className="space-y-3"><legend className="mb-3 text-sm">Select one validation type</legend>{[...Object.keys(requirements), 'Not sure'].map(option => <label key={option} className={`${field} flex cursor-pointer items-center gap-3 ${type === option ? 'ring-2 ring-[var(--zk-accent)]' : ''}`}><input type="radio" name="validation-type" value={option} checked={type === option} onChange={() => { setType(option as typeof type); setVerifierId(''); }} />{option}</label>)}</fieldset><Button disabled={!type || !context.recipientId || !context.documentType || !context.jurisdiction} onClick={() => setStep(3)}>Continue →</Button></>}
      {step === 3 && <>
        <h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-6" : undefined}>Understand the requirement.</h1>
        {policy ? <>
          {type === 'Not sure' && <p role="status" className="rounded-xl bg-[var(--zk-info-bg)] p-4">Simulated analysis: this fictional recipient policy requires <strong>{policy.validationType}</strong>.</p>}
          <PolicySummary policy={policy} />
          <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-7" : undefined}>Eligibility depends on the receiving organisation, document type and jurisdiction.</p>
          <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-8" : undefined}>Prototype recommendation — eligibility would be confirmed before a real validation request is created. These example matches do not establish professional eligibility.</p>
          <Button onClick={() => setStep(4)}>Continue →</Button>
        </> : <Card className="space-y-3 !rounded-2xl p-5">
          <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-9" : undefined}>Requirements need clarification</h2>
          <p className="text-sm">{resolution.status === 'needs_clarification' ? resolution.reason : ''}</p>
          <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-10" : undefined}>This means the requirements are unresolved, not that you need an in-person visit. Confirm them with the receiving organisation. No request is sent and no appointment is booked here.</p>
          {resolution.status === 'needs_clarification' && resolution.suggestedType && <Button onClick={() => { setType(resolution.suggestedType!); setVerifierId(''); }}>Use {resolution.suggestedType.toLowerCase()}</Button>}
        </Card>}
      </>}
      {step === 4 && <><h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-11" : undefined}>Choose a verifier.</h1><p className="text-sm">Fictional example matches for {validationType.toLowerCase()}. A real request would first confirm the recipient’s requirements.</p><fieldset className="space-y-3"><legend className="sr-only">Select one verifier</legend>{verifiers.map(v => { const result = policy ? eligibility(policy, v) : { eligible: false, reason: 'No matching recipient policy.' }; const eligible = result.eligible; return <label key={v.id} className={`${field} flex items-start gap-3 ${!eligible ? 'opacity-55' : 'cursor-pointer'} ${verifierId === v.id ? 'ring-2 ring-[var(--zk-accent)]' : ''}`}><input className="mt-1" type="radio" name="verifier" checked={verifierId === v.id} disabled={!eligible} onChange={() => setVerifierId(v.id)} /><span><strong className="block">{v.name}</strong><span className="block text-sm">{v.profession}</span><span className="mt-2 block text-xs" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-12" : undefined}>Professional status: Verified ✓ · Simulated</span><span className="block text-xs">{result.reason}</span></span></label>; })}</fieldset><Button disabled={!verifierId} loading={busy} onClick={() => void submit()}>Continue with selected verifier</Button></>}
      <div><Button variant="ghost" disabled={busy} onClick={() => setStep(step - 1)}>Back</Button></div>
    </> : view === 'customer' ? <>
      <section className="py-4"><h1 className="text-[40px] font-extrabold leading-tight tracking-tight" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-13" : undefined}>Get it validated.</h1><p className="mt-4 text-[15px] leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-14" : undefined}>Upload a document you&apos;ve been asked to have certified, witnessed or independently verified.</p><Button className="mt-5" onClick={() => { setType(''); setContext(emptyContext); setVerifierId(''); setFile(null); setStep(1); }}>Upload document</Button><details id="how-it-works" className="mt-5 scroll-mt-24"><summary className="cursor-pointer font-semibold">How does it work?</summary><ValidationWorkflow /><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-15" : undefined}>Zik provides the workflow and evidence of an attestation. It does not guarantee the underlying truth of every statement.</p></details></section>
      {record && <><ValidationDetails record={record} />{record.status === 'validated' && <div className="flex flex-wrap gap-3"><ButtonLink href={`/validate/verify?id=${record.id}`}>View validation</ButtonLink><Button variant="secondary" onClick={receipt}>Download prototype receipt</Button></div>}{record.status === 'declined' && <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-16" : undefined}>The verifier could not attest to this request. Start a new request after clarifying the receiving organisation’s requirements.</p>}</>}
    </> : <>
      <h1 className="text-3xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-17" : undefined}>Validation request</h1><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-18" : undefined}>Verifier demo · Acting as the selected fictional professional.</p>
      {!record ? <Card className="p-5">No requests yet. Return to the customer view and upload a dummy document.</Card> : <><ValidationDetails record={record} />
        <Button variant="secondary" loading={busy} onClick={() => void run(async () => { setPreview(URL.createObjectURL(record.file)); if (record.status === 'awaiting_verifier') await transition(record.id, 'under_review'); await refresh(); })}>Review document</Button>
        {preview && <div className="space-y-3"><p className="text-sm font-semibold break-words">Reviewing {record.documentName}</p>{record.file.type === 'application/pdf' ? <iframe title="Uploaded document preview" src={preview} className="h-96 w-full rounded-xl border" /> : <Image unoptimized width={528} height={384} alt="Uploaded document preview" src={preview} className="max-h-96 w-full object-contain" />}<a href={preview} target="_blank" rel="noreferrer" className="text-sm underline" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-19" : undefined}>Open document preview</a></div>}
        {['awaiting_verifier', 'under_review'].includes(record.status) && <>
          <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-20" : undefined}>Reviewing the upload is only the first step. Complete the check arrangements shown above, then confirm every evidence check before validating.</p>
          {!canAttest(record) && <p role="status" className="rounded-xl bg-[var(--zk-caution-bg)] p-4 text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-21" : undefined}>This older request has no applicable policy with defined check arrangements. It can be reviewed or declined, but a new request is needed before validation.</p>}
          <div className="flex gap-3">
            <Button disabled={busy || record.status !== 'under_review' || !canAttest(record)} onClick={() => { setAttesting(true); setDeclining(false); }}>Validate</Button>
            <Button variant="secondary" disabled={busy} onClick={() => { setDeclining(true); setAttesting(false); }}>Cannot validate</Button>
          </div>
          {declining && <Card className="space-y-4 !rounded-2xl p-5">
            <label className="block text-sm font-semibold">Reason for declining
              <select className={`${field} mt-2`} value={declineReason} onChange={event => setDeclineReason(event.target.value as DeclineReason | '')}>
                <option value="">Select a reason</option>
                {Object.entries(declineReasons).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <Button disabled={!declineReason} loading={busy} onClick={() => void run(async () => {
              if (!declineReason) return;
              await transition(record.id, 'declined', { declineReason }); await refresh(); setDeclining(false);
            })}>Confirm decline</Button>
          </Card>}
          {attesting && record.policy && <Card className="space-y-4 !rounded-2xl p-5">
            <h2 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-22" : undefined}>What you are attesting to</h2>
            <p className="text-sm">{record.validationStatement}</p>
            <fieldset className="space-y-4">
              <legend className="mb-3 font-bold">Required evidence checks</legend>
              {record.policy.evidence.map(check => <label key={check.id} className="flex items-start gap-3 text-sm">
                <input className="mt-1" type="checkbox" checked={evidenceIds.includes(check.id)} onChange={event => setEvidenceIds(previous => event.target.checked ? [...new Set([...previous, check.id])] : previous.filter(id => id !== check.id))} />
                {check.label}
              </label>)}
            </fieldset>
            <label className="flex items-start gap-3"><input className="mt-1" type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />I have completed the checks described above.</label>
            <p className="text-xs" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-23" : undefined}>Evidence confirmations and acknowledgement are simulated for this fictional demonstration.</p>
            <Button disabled={!ack || !record.policy.evidence.every(check => evidenceIds.includes(check.id))} loading={busy} onClick={() => void run(async () => {
              await transition(record.id, 'validated', { acknowledged: ack, evidenceIds }); await refresh(); setAttesting(false); setAck(false); setEvidenceIds([]);
            })}>Validate document</Button>
          </Card>}
        </>}
      </>}
    </>}
    {step === 0 && records.length > 1 && <label className="block text-sm">Request history<select className={`${field} mt-2`} value={record?.id ?? ''} onChange={e => setActiveId(e.target.value)}>{records.map(r => <option key={r.id} value={r.id}>{r.documentName} · {r.status} · {r.id}</option>)}</select></label>}
    <p className="text-xs leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f46a2f6c1af1-24" : undefined}>Requirements vary by document, receiving organisation and jurisdiction. Local prototype records are editable browser data, not authenticated attestations. Clear site data to remove saved documents and requests.</p>
  </div>;
}
