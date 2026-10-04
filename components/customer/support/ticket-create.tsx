"use client";
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink, Card } from '@/components/customer/ui';
import { CATEGORIES, label } from '@/lib/shared/support/model';
import { containsSupportSecret } from '@/lib/shared/support/validation';
import { bytesToBase64Url } from '@/lib/shared/utils';
import { GoogleBusinessSearch, type GoogleBusiness } from './google-business-search';
const control = 'mt-1.5 w-full rounded-xl border border-[var(--zk-line-strong)] bg-white p-3 text-base';
export function TicketCreate({ partnerStore = false }: { partnerStore?: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState(partnerStore ? 'store_partner' : 'general');
  const [storeName, setStoreName] = useState('');
  const [googleBusiness, setGoogleBusiness] = useState<GoogleBusiness | null>(null);
  const [location, setLocation] = useState('');
  const [contactName, setContactName] = useState('');
  const pendingKey = partnerStore ? 'zik-partner-store-pending' : 'zik-support-pending';
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
    if ([subject, body, email, reference, storeName, location, contactName].some(containsSupportSecret)) { setError('Remove recovery words, passphrases, PINs or private keys before sending.'); return; }
    if (partnerStore && [storeName, location, contactName, email].some(value => !value.trim())) { setError('Enter your store, location, name and work email.'); return; }
    if (!consent) { setError('Please confirm that this message contains no secrets.'); return; }
    setBusy(true);
    try {
      // Keep a random retry key, never ticket text or personal data, between retries.
      const previous = sessionStorage.getItem(pendingKey);
      const pending = previous ? JSON.parse(previous) as { requestId: string; accessKey: string } : { requestId: crypto.randomUUID(), accessKey: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32))) };
      sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      const response = await fetch('/api/support/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending, category, subject: partnerStore ? `Store partnership: ${storeName.trim()}` : subject, body: partnerStore ? `Store: ${storeName.trim()}\nLocation: ${location.trim()}\nContact: ${contactName.trim()}${googleBusiness ? `\nGoogle Place ID: ${googleBusiness.id}` : ""}\n\n${body.trim() || "Interested in becoming a Zik partner store."}` : body, email, errorReference: reference, ...(diagnostics ? { diagnostic: `Browser: ${navigator.userAgent.slice(0, 300)}; viewport: ${window.innerWidth}×${window.innerHeight}; online: ${navigator.onLine}` } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not submit your ticket. Please retry.');
      sessionStorage.setItem(`zik-support:${result.id}`, pending.accessKey);
      sessionStorage.removeItem(pendingKey);
      router.push(`/help/ticket/${result.id}` as never);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send your request. Please try again.'); } finally { setBusy(false); }
  }
  return <Card as="section" className="!rounded-2xl p-5" >
    <h2 className="text-xl font-extrabold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-1" : undefined}>{partnerStore ? "Become a partner store" : "Contact Zik Support"}</h2><p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-2" : undefined}>{partnerStore ? "Tell us about your store. Your enquiry goes to the Zik team, with a private link to follow the conversation. This does not activate or publicly list your store." : "Describe the issue and get a private ticket link for replies. Support messages are readable by the support team. Never include your 24 recovery words, passphrases, PIN, ID images or payment details."}</p>
    {category === 'recovery' ? <div className="mt-4 rounded-xl bg-[var(--zk-sunken)] p-4 text-sm"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-3" : undefined}>Lost your phone and card? Your saved recovery phrase belongs only on the recovery screen. Support cannot retrieve it or bypass encryption.</p><ButtonLink href="/account-recovery/restore" variant="secondary" className="mt-3">Recover with my phrase</ButtonLink></div> : null}
    <form onSubmit={e => void submit(e)} className="mt-5 space-y-4">
      {partnerStore ? <>
        <GoogleBusinessSearch onSelect={business => { setGoogleBusiness(business); setStoreName(business.name.slice(0, 120)); setLocation(business.address.slice(0, 300)); }} />
        {googleBusiness ? <div className="text-sm"><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-5" : undefined}>Google listing selected. You can correct the imported details.</p><button type="button" className="mt-1 underline" onClick={() => setGoogleBusiness(null)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-6" : undefined}>Remove Google listing link</button></div> : null}
        <label className="block text-sm font-semibold">Store or business name<input className={control} required maxLength={120} autoComplete="organization" value={storeName} onChange={e => setStoreName(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Town and postcode (full address if available)<input className={control} required maxLength={300} value={location} onChange={e => setLocation(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Your name<input className={control} required maxLength={120} autoComplete="name" value={contactName} onChange={e => setContactName(e.target.value)} /></label>
      </> : <>
      <label className="block text-sm font-semibold">What do you need help with?<select className={control} value={category} onChange={e => setCategory(e.target.value)}>{CATEGORIES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></label>
      <label className="block text-sm font-semibold">Subject<input className={control} required minLength={3} maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} /></label>
      </>}
      <label className="block text-sm font-semibold">{partnerStore ? "Anything else? (optional)" : "What happened?"}<textarea className={control} required={!partnerStore} rows={partnerStore ? 3 : 5} maxLength={partnerStore ? 5000 : 6000} value={body} onChange={e => setBody(e.target.value)} placeholder={partnerStore ? "Store type, number of locations, or questions for us. Please do not include customer information." : "What were you trying to do? What happened instead? Include safe steps to reproduce and roughly when it happened."} /></label>
      {!partnerStore ? <label className="block text-sm font-semibold">Error reference (optional)<input className={control} maxLength={80} placeholder="err_…" value={reference} onChange={e => setReference(e.target.value)} /></label> : null}
      <label className="block text-sm font-semibold">{partnerStore ? "Work email" : "Contact email (optional)"}<input required={partnerStore} type="email" className={control} autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /><span className="mt-1 block text-xs font-normal text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-30f16f0555ad-4" : undefined}>For manual follow-up if needed. Replies are posted in your ticket; no automatic emails are sent.</span></label>
      {!partnerStore ? <label className="flex gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={diagnostics} onChange={e => setDiagnostics(e.target.checked)} />Include my browser version, window size and online/offline status. No Vault contents or browsing history.</label> : null}
      <label className="flex gap-3 text-sm"><input type="checkbox" required className="mt-1 h-4 w-4 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />{partnerStore ? "I agree that Zik can use these business contact details to respond to my enquiry. The team can read this message." : "I have removed secrets and identity/payment details, and understand the support team can read this message."}</label>
      {error ? <p role="alert" className="text-sm text-red-800">{error}</p> : null}
      <Button type="submit" loading={busy}>{partnerStore ? "Send store enquiry" : "Create private help ticket"}</Button>
    </form>
    <ButtonLink href="/help/policy" variant="ghost" className="mt-2">How support handles your request</ButtonLink>
  </Card>;
}
