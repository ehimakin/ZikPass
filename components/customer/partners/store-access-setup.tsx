"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { Button, ButtonLink, Card } from '@/components/customer/ui';
import { ZIK_STORES } from '@/lib/shared/stores';
const field = 'mt-2 w-full rounded-lg border border-[var(--zk-line-strong)] bg-white p-3';
export function StoreAccessSetup() {
  const [csrf, setCsrf] = useState('');
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState(ZIK_STORES[0].id);
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    fetch('/api/admin/session', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (active) setCsrf(data.session?.csrf ?? '');
    }).catch(() => { if (active) setError('Could not check setup access. Refresh to try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(''); setSaved(false);
    if (code !== confirmation) { setError('The staff codes do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/partners/store-access', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ storeId, code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not save the staff code.');
      setCode(''); setConfirmation(''); setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the staff code.'); }
    finally { setBusy(false); }
  }
  return <Card as="section" className="space-y-4 p-5">
    <h2 className="text-xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c26099c2439a-1" : undefined}>Set up store access</h2>
    <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c26099c2439a-2" : undefined}>Set the staff login code for a configured store. Staff then sign in from the store dashboard on their terminal.</p>
    {loading ? <p role="status" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c26099c2439a-3" : undefined}>Checking setup access…</p> : !csrf ? <div className="space-y-3"><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c26099c2439a-4" : undefined}>A Zik admin sets or changes staff codes during store setup.</p><ButtonLink href="/dashboard/admin" variant="secondary">Admin sign-in</ButtonLink></div> : <form onSubmit={save} className="space-y-4">
      <label className="block text-sm font-semibold">Store<select className={field} value={storeId} onChange={event => { setStoreId(event.target.value); setSaved(false); setCode(''); setConfirmation(''); }}>{ZIK_STORES.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <label className="block text-sm font-semibold">New staff code<input className={field} type="password" autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label>
      <label className="block text-sm font-semibold">Confirm staff code<input className={field} type="password" autoComplete="new-password" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value.replace(/\D/g, ''))} /></label>
      <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c26099c2439a-5" : undefined}>Use six digits. Saving replaces this store’s previous code and signs out existing staff sessions.</p>
      <Button type="submit" loading={busy}>Save staff code</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    {saved && <p role="status" className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c26099c2439a-6" : undefined}>Staff code saved. You can now sign in to this store.</p>}
    <ButtonLink href="/dashboard/store/login" variant="ghost">Staff sign-in</ButtonLink>
  </Card>;
}
