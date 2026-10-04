"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Card } from '@/components/customer/ui';
import { GoogleBusinessSearch } from '@/components/customer/support/google-business-search';
import { applicationIssue, emptyApplication, SERVICES, SETUP_TASKS, STORE_TYPES, type ApplicationInput, type PartnerApplication, type SetupTask } from '@/lib/shared/partners/application';
import { bytesToBase64Url } from '@/lib/shared/utils';
const control = 'mt-1.5 w-full rounded-xl border border-[var(--zk-line-strong)] bg-white p-3 text-base';
const sessionKey = 'zik-partner-application-session';
type Session = { requestId: string; accessKey: string; id?: string };
const steps = ['Your store', 'Your contact', 'Services', 'Review'];
export function PartnerOnboarding({ enabled }: { enabled: boolean }) {
  const [details, setDetails] = useState<ApplicationInput>({ ...emptyApplication });
  const [step, setStep] = useState(0);
  const [application, setApplication] = useState<PartnerApplication | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  function field<K extends keyof ApplicationInput>(name: K, value: ApplicationInput[K]) { setDetails(previous => ({ ...previous, [name]: value })); setError(''); }
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let active = true;
    async function resume() {
      try {
        const saved = sessionStorage.getItem(sessionKey);
        if (!saved) return;
        const value: Session = JSON.parse(saved);
        if (!/^[A-Za-z0-9_-]{43}$/.test(value.accessKey) || typeof value.requestId !== 'string') throw new Error('This browser’s application session could not be read.');
        if (active) setSession(value);
        if (value.id) {
          const response = await fetch(`/api/partners/applications?id=${encodeURIComponent(value.id)}`, { headers: { Authorization: `Bearer ${value.accessKey}` }, cache: 'no-store' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          if (active) setApplication(result.application);
        }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Could not resume your application.'); }
      finally { if (active) setLoading(false); }
    }
    void resume(); return () => { active = false; };
  }, [enabled]);
  function go(next: number) { setStep(next); setError(''); requestAnimationFrame(() => title.current?.focus()); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const issue = applicationIssue(details, step); if (issue) { setError(issue); return; }
    if (step < 3) { go(step + 1); return; }
    const allIssues = applicationIssue(details); if (allIssues) { setError(allIssues); return; }
    setBusy(true); setError('');
    try {
      const pending = session ?? { requestId: crypto.randomUUID(), accessKey: bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32))) };
      // Save only access material, not the applicant's form fields, in this tab.
      sessionStorage.setItem(sessionKey, JSON.stringify(pending)); setSession(pending);
      const response = await fetch('/api/partners/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pending.accessKey}` }, body: JSON.stringify({ action: 'create', requestId: pending.requestId, details }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      const saved = { ...pending, id: result.application.id };
      sessionStorage.setItem(sessionKey, JSON.stringify(saved)); setSession(saved); setApplication(result.application);
      requestAnimationFrame(() => title.current?.focus());
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit. Your details are still here; please retry.'); }
    finally { setBusy(false); }
  }
  async function update(action: string, task?: SetupTask, complete?: boolean) {
    if (!session?.id || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/partners/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessKey}` }, body: JSON.stringify({ id: session.id, action, task, complete }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setApplication(result.application);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update setup. Please retry.'); }
    finally { setBusy(false); }
  }
  function reset() { sessionStorage.removeItem(sessionKey); setSession(null); setApplication(null); setDetails({ ...emptyApplication }); go(0); }
  if (!enabled) return <Card className="p-5"><h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-1" : undefined}>Partner applications are coming soon</h2><p className="mt-3 text-sm">The guided signup is currently a development prototype. Contact the partner team through <a href="/help#contact-support" className="underline" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-2" : undefined}>Zik support</a> to discuss joining.</p></Card>;
  if (loading) return <p role="status" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-3" : undefined}>Checking for your application…</p>;
  if (application) return <Card className="!rounded-2xl p-5 space-y-5">
    <p className="text-xs font-bold uppercase tracking-wider text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-4" : undefined}>Partner workspace · Development prototype</p>
    <h2 ref={title} tabIndex={-1} className="text-2xl font-extrabold">{application.status === 'submitted' ? 'Application received' : application.status === 'setup' ? 'Let’s get your store ready' : 'Demo setup complete'}</h2>
    <p className="text-sm">{application.status === 'submitted' ? 'Your store application has been saved. In the live service, the partner team would review it and agree commercial terms before setup.' : application.status === 'setup' ? 'Your application has passed a simulated review. Work through the preparation checklist below.' : 'You have completed the prototype journey. A real launch still needs team approval, agreed terms and staff access.'}</p>
    <div className="rounded-xl bg-[var(--zk-sunken)] p-4 space-y-2 text-sm"><p className="font-bold">{application.details.storeName}</p><p>{application.details.address}</p><p>{application.details.contactName} · {application.details.email}</p><p>{application.details.services.map(service => SERVICES[service]).join(' · ')}</p><p className="break-all text-xs">Application reference: {application.id}</p></div>
    <ol aria-label="Application progress" className="space-y-2 text-sm">
      <li data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-5" : undefined}>✓ Application saved</li><li>{application.status === 'submitted' ? '2. Partner review — pending' : '✓ Demo review complete'}</li><li>{application.status === 'ready' ? '✓ Demo setup complete' : '3. Store setup'}</li><li data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-6" : undefined}>4. Live activation — requires the Zik team</li>
    </ol>
    {application.status === 'submitted' ? <div className="rounded-xl border border-dashed border-[var(--zk-line-strong)] p-4 space-y-3"><h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-7" : undefined}>Try the next stage</h3><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-8" : undefined}>Prototype only: simulate a successful review to explore store setup. This does not approve or activate a real store.</p><Button type="button" variant="secondary" loading={busy} onClick={() => void update('simulate_review')}>Simulate partner review</Button></div> : <section className="space-y-3" aria-label="Store setup checklist"><h3 className="font-bold">Store setup · {application.completedTasks.length} of 3 complete</h3>
      <details className="rounded-xl bg-[var(--zk-sunken)] p-4 text-sm"><summary className="cursor-pointer font-semibold">Preview staff ID-check guidance</summary><p className="mt-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-9" : undefined}>Use the staff verification flow to inspect physical photo ID and compare the person present with the document. Do not upload or retain ID images. If unsure, pause and contact the partner team. Final accepted-ID guidance and staff training must be agreed before launch.</p></details>
      {(Object.entries(SETUP_TASKS) as [SetupTask, string][]).map(([key, label]) => <label key={key} className="flex gap-3 rounded-xl border border-[var(--zk-line)] p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" disabled={busy} checked={application.completedTasks.includes(key)} onChange={event => void update('task', key, event.target.checked)} />{label}</label>)}
    </section>}
    <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-10" : undefined}>No email has been sent and your store is not publicly listed. Return to this page in the same browser tab to resume for up to 30 days. Closing the tab may remove access. The development server retains the application; this prototype has no automatic retention cleanup.</p>
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    <details className="text-sm"><summary className="cursor-pointer underline">Apply for another store</summary><p className="my-3" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-11" : undefined}>Starting again removes this tab’s access to this application. Its server record remains.</p><Button type="button" variant="secondary" disabled={busy} onClick={reset}>Start another application</Button></details>
  </Card>;
  if (session?.id) return <Card className="!rounded-2xl p-5 space-y-4"><h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-12" : undefined}>Resume your application</h2><p role="alert" className="text-sm text-red-800">{error || 'Could not load your saved application.'}</p><Button type="button" onClick={() => window.location.reload()}>Retry loading application</Button><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-13" : undefined}>Starting another application removes this tab’s access to the previous one; its server record remains.</p><Button type="button" variant="secondary" onClick={reset}>Start another application</Button></Card>;
  return <Card className="!rounded-2xl p-5 space-y-5">
    <p className="text-xs font-bold uppercase tracking-wider text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-14" : undefined}>Partner application · Development prototype</p>
    <ol aria-label="Application steps" className="grid grid-cols-4 gap-2 text-xs">{steps.map((name, index) => <li key={name} aria-current={step === index ? 'step' : undefined} className={`border-t-4 pt-2 ${index <= step ? 'border-ink font-bold' : 'border-[var(--zk-line)] text-[var(--zk-text-soft)]'}`}>{index + 1}. {name}</li>)}</ol>
    <h2 ref={title} tabIndex={-1} className="text-2xl font-extrabold">{['Find your store', 'Who should we work with?', 'What would you like to offer?', 'Review your application'][step]}</h2>
    <form onSubmit={event => void submit(event)} className="space-y-4">
      {step === 0 && <>
        <GoogleBusinessSearch onSelect={business => { setDetails(previous => ({ ...previous, storeName: business.name.slice(0, 120), address: business.address.slice(0, 300), googlePlaceId: business.id })); setError(''); }} />
        {details.googlePlaceId && <p className="text-sm">Google listing linked. <button type="button" className="underline" onClick={() => field('googlePlaceId', '')} data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-15" : undefined}>Remove listing link</button></p>}
        <label className="block text-sm font-semibold">Store or business name<input required maxLength={120} autoComplete="organization" className={control} value={details.storeName} onChange={event => field('storeName', event.target.value)} /></label>
        <label className="block text-sm font-semibold">Full store address and postcode<input required maxLength={300} autoComplete="street-address" className={control} value={details.address} onChange={event => field('address', event.target.value)} /></label>
        <label className="block text-sm font-semibold">Store type<select required className={control} value={details.storeType} onChange={event => field('storeType', event.target.value)}><option value="">Choose store type</option>{STORE_TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      </>}
      {step === 1 && <>
        <label className="block text-sm font-semibold">Your name<input required maxLength={120} autoComplete="name" className={control} value={details.contactName} onChange={event => field('contactName', event.target.value)} /></label>
        <label className="block text-sm font-semibold">Work email<input required type="email" maxLength={254} autoComplete="email" className={control} value={details.email} onChange={event => field('email', event.target.value)} /></label>
        <label className="block text-sm font-semibold">Your role<select required className={control} value={details.role} onChange={event => field('role', event.target.value)}><option value="">Choose your role</option>{['Owner', 'Manager', 'Authorised representative'].map(role => <option key={role}>{role}</option>)}</select></label>
        <label className="flex gap-3 text-sm"><input required type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={details.authority} onChange={event => field('authority', event.target.checked)} />I am authorised to apply on behalf of this store.</label>
      </>}
      {step === 2 && <fieldset className="space-y-3"><legend className="mb-3 text-sm">Choose the services you’re interested in. Fees and any revenue share are agreed separately before activation.</legend>{(Object.entries(SERVICES) as [keyof typeof SERVICES, string][]).map(([key, name]) => <label key={key} className="flex gap-3 rounded-xl border border-[var(--zk-line)] p-4"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={details.services.includes(key)} onChange={event => field('services', event.target.checked ? [...details.services, key] : details.services.filter(value => value !== key))} /><span><span className="block font-semibold">{name}</span><span className="mt-1 block text-sm text-[var(--zk-text-soft)]">{key === 'digital' ? 'Help customers verify their photo ID and add a digital pass to their phone.' : 'Sell a physical card and help customers link it to their phone.'}</span></span></label>)}</fieldset>}
      {step === 3 && <>
        <dl className="space-y-4 rounded-xl bg-[var(--zk-sunken)] p-4 text-sm">
          <div><dt className="font-bold">Store <button type="button" className="ml-2 underline font-normal" onClick={() => go(0)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-16" : undefined}>Edit store</button></dt><dd className="mt-1">{details.storeName}<br />{details.address}<br />{details.storeType}{details.googlePlaceId ? ' · Google listing linked' : ''}</dd></div>
          <div><dt className="font-bold">Contact <button type="button" className="ml-2 underline font-normal" onClick={() => go(1)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-17" : undefined}>Edit contact</button></dt><dd className="mt-1 break-words">{details.contactName} · {details.role}<br />{details.email}</dd></div>
          <div><dt className="font-bold">Services <button type="button" className="ml-2 underline font-normal" onClick={() => go(2)} data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-18" : undefined}>Edit services</button></dt><dd className="mt-1">{details.services.map(service => SERVICES[service]).join(' · ')}</dd></div>
        </dl>
        <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-19" : undefined}>This prototype saves a store application on the development server. It does not verify ownership, send email, agree commercial terms or list your store. Please use test details.</p>
        <label className="flex gap-3 text-sm"><input required type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={details.consent} onChange={event => field('consent', event.target.checked)} />I agree that Zik can store these business contact details to review this application.</label>
      </>}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <div className="flex gap-3">{step > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => go(step - 1)}>Back</Button>}<Button type="submit" loading={busy}>{step === 3 ? 'Submit store application' : 'Continue'}</Button></div>
    </form>
    <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5d140616e920-20" : undefined}>Applying is free. Your store stays private until approved and activated by the Zik team. Draft fields are not saved if you leave before submitting.</p>
  </Card>;
}
