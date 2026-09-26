"use client";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink, Card } from '@/components/customer/ui';
import { CATEGORIES, label } from '@/lib/shared/support/model';
import { containsSupportSecret } from '@/lib/shared/support/validation';
import { bytesToBase64Url } from '@/lib/shared/utils';
const control = 'mt-1.5 w-full rounded-xl border border-[var(--zk-line-strong)] bg-white p-3 text-base';
export function TicketCreate() {
  const router = useRouter();
  const [category, setCategory] = useState('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [diagnostics, setDiagnostics] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError('');
    if ([subject, body, email, reference].some(containsSupportSecret)) { setError('Remove recovery words, passphrases, PINs or private keys before sending.'); return; }
    if (!consent) { setError('Please confirm that this message contains no secrets.'); return; }
    setBusy(true);
    try {
      // Keep a random retry key, never ticket text or personal data, between retries.
      const previous = sessionStorage.getItem('zik-support-pending');
      const pending = previous ? JSON.parse(previous) as { requestId: string; accessKey: string } : { requestId: crypto.randomUUID(), accessKey: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32))) };
      sessionStorage.setItem('zik-support-pending', JSON.stringify(pending));
      const response = await fetch('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending, category, subject, body, email, errorReference: reference, ...(diagnostics ? { diagnostic: `Browser: ${navigator.userAgent.slice(0, 300)}; viewport: ${window.innerWidth}×${window.innerHeight}; online: ${navigator.onLine}` } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not submit your ticket. Please retry.');
      sessionStorage.setItem(`zik-support:${result.id}`, pending.accessKey);
      sessionStorage.removeItem('zik-support-pending');
      router.push(`/help/ticket/${result.id}` as never);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send your request. Please try again.'); } finally { setBusy(false); }
  }
  return <Card as="section" className="!rounded-2xl p-5" >
    <h2 className="text-xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-1" : undefined}>Contact Zik Support</h2><p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-2" : undefined}>Describe the issue and get a private ticket link for replies. Support messages are readable by the support team. Never include your 24 recovery words, passphrases, PIN, ID images or payment details.</p>
    {category === 'recovery' ? <div className="mt-4 rounded-xl bg-[var(--zk-sunken)] p-4 text-sm"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-3" : undefined}>Lost your phone and card? Your saved recovery phrase belongs only on the recovery screen. Support cannot retrieve it or bypass encryption.</p><ButtonLink href="/account-recovery/restore" variant="secondary" className="mt-3">Recover with my phrase</ButtonLink></div> : null}
    <form onSubmit={e => void submit(e)} className="mt-5 space-y-4">
      <label className="block text-sm font-semibold">What do you need help with?<select className={control} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="block text-sm font-semibold">Subject<input className={control} required minLength={3} maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} /></label>
      <label className="block text-sm font-semibold">What happened?<textarea className={control} required rows={5} maxLength={6000} value={body} onChange={e => setBody(e.target.value)} placeholder="What were you trying to do? What happened instead? Include safe steps to reproduce and roughly when it happened." /></label>
      <label className="block text-sm font-semibold">Error reference (optional)<input className={control} maxLength={80} placeholder="err_…" value={reference} onChange={e => setReference(e.target.value)} /></label>
      <label className="block text-sm font-semibold">Contact email (optional)<input type="email" className={control} autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /><span className="mt-1 block text-xs font-normal text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-4" : undefined}>For manual follow-up if needed. Replies are posted in your ticket; no automatic emails are sent.</span></label>
      <label className="flex gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={diagnostics} onChange={e => setDiagnostics(e.target.checked)} />Include my browser version, window size and online/offline status. No Vault contents or browsing history.</label>
      <label className="flex gap-3 text-sm"><input type="checkbox" required className="mt-1 h-4 w-4 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />I have removed secrets and identity/payment details, and understand the support team can read this message.</label>
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      <Button type="submit" loading={busy}>Create private help ticket</Button>
    </form>
    <ButtonLink href="/help/policy" variant="ghost" className="mt-2">How support handles your request</ButtonLink>
  </Card>;
}
