'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { VaultSession } from '@/lib/client/vault-adapter';
import { type VaultProfileV1, type ProfileField } from '@/lib/shared/vault';
import { Button, ButtonLink, Card, StatusBadge } from './ui';
export const fieldLabels: Record<ProfileField,string> = {legal_name:'Legal name',delivery_address:'Delivery address',email:'Email'};
export function VaultScreen({onUnlocked}: {onUnlocked?: (profile: VaultProfileV1 | undefined) => void}) {
  const session = useRef(new VaultSession());
  const [exists,setExists] = useState<boolean>();
  const [profile,setProfile] = useState<VaultProfileV1>();
  const [secret,setSecret] = useState('');
  const [values,setValues] = useState({legal_name:'',delivery_address:'',email:''});
  const [selfie,setSelfie] = useState<string>();
  const [selfieCapturedAt,setSelfieCapturedAt] = useState<string>();
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('Checking local storage…');
  const lock = useCallback(() => { session.current.lock(); setProfile(undefined); setSecret(''); setValues({legal_name:'',delivery_address:'',email:''}); setSelfie(undefined); setSelfieCapturedAt(undefined); onUnlocked?.(undefined); setMessage('Vault locked.'); },[onUnlocked]);
  useEffect(() => { void session.current.exists().then(v => {setExists(v);setMessage(v?'Vault locked.':'Create your local Vault.');}).catch(() => setMessage('Local Vault storage is unavailable. Use a supported browser on HTTPS or localhost.')); },[]);
  useEffect(() => {
    const currentSession = session.current;
    let timer: ReturnType<typeof setTimeout>;
    const touch = () => { clearTimeout(timer); timer = setTimeout(lock,120000); };
    const visibility = () => { if (document.hidden) lock(); };
    touch(); window.addEventListener('pointerdown',touch); window.addEventListener('keydown',touch); document.addEventListener('visibilitychange',visibility);
    return () => {clearTimeout(timer);window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch);document.removeEventListener('visibilitychange',visibility);currentSession.lock();};
  },[lock]);
  async function unlock() {
    setBusy(true); const passphrase = secret; setSecret('');
    try { await session.current.unlock(passphrase); const p = session.current.read(); setProfile(p); setValues({legal_name:p.legal_name.value,delivery_address:p.delivery_address.value,email:p.email?.value??''});setSelfie(p.selfie?.data_url);setSelfieCapturedAt(p.selfie?.captured_at);onUnlocked?.(p);setMessage('Vault unlocked on this device.'); }
    catch {setMessage('Unable to unlock. Check your passphrase; the saved Vault has not been changed.');} finally {setBusy(false);}
  }
  async function save() {
    setBusy(true); const passphrase = secret; setSecret('');
    try {
      const updated_at = new Date().toISOString();
      const field = (f: ProfileField) => profile?.[f]?.value === values[f].trim() ? profile[f]! : {value:values[f].trim(),provenance:'self_entered' as const,updated_at};
      const p: VaultProfileV1 = {version:1,legal_name:field('legal_name'),delivery_address:field('delivery_address'),...(values.email.trim()?{email:field('email')}:{}),...(selfie?{selfie:{data_url:selfie,provenance:'device_selfie' as const,captured_at:selfieCapturedAt??updated_at}}:{})};
      await session.current.save(p,passphrase);setProfile(p);setExists(true);onUnlocked?.(p);setMessage('Encrypted Vault saved on this device.');
    } catch {setMessage('Unable to save. Use a passphrase of at least 12 characters; existing data is preserved.');} finally {setBusy(false);}
  }
  async function remove() {setBusy(true);lock();try{await session.current.delete();setExists(false);setMessage('Vault deleted from this device.');}catch{setMessage('Deletion failed. Your Vault remains locked; retry deletion.');}finally{setBusy(false);}}
  async function selectSelfie(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await resizeSelfie(file);
      setSelfie(dataUrl); setSelfieCapturedAt(new Date().toISOString()); setMessage('Designated Zik ID selfie ready to save in this Vault.');
    } catch { setMessage('That photo could not be prepared. Choose a JPEG, PNG or WebP image under 10 MB.'); }
  }
  return <Card className="space-y-4 p-5">
    <h1 className="text-2xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eb4a03fbed87-1" : undefined}>Zik Vault</h1>
    <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eb4a03fbed87-2" : undefined}>Name and address are self-entered, not checked by Zik. Your pass supplies the separate Zik-verified age result.</p>
    <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eb4a03fbed87-3" : undefined}>Encrypted on this device with your passphrase. No cloud backup or passphrase recovery. Locks on reload, when hidden, or after two minutes of inactivity.</p>
    <p role="status" aria-live="polite">{message}</p>
    {exists !== undefined && <form onSubmit={e=>{e.preventDefault();void (exists&&!profile?unlock():save());}} className="space-y-4" autoComplete="off">
      {(!exists||profile)&&(['legal_name','delivery_address','email'] as const).map(f=><label key={f} className="block space-y-1 text-sm"><span>{fieldLabels[f]} {f==='email'?'(optional)':''} <StatusBadge>Self-entered</StatusBadge></span>{f==='delivery_address'?<textarea required maxLength={512} rows={3} aria-label={fieldLabels[f]} className="w-full rounded-lg border p-3" placeholder="Street, town, postcode, United Kingdom" value={values[f]} onChange={e=>setValues({...values,[f]:e.target.value})}/>:<input aria-label={fieldLabels[f]} required={f!=='email'} type={f==='email'?'email':'text'} maxLength={512} className="w-full rounded-lg border p-3" value={values[f]} onChange={e=>setValues({...values,[f]:e.target.value})}/>}</label>)}
      {(!exists||profile)&&<div className="space-y-2 rounded-xl border border-[var(--zk-line)] bg-[var(--zk-sunken)] p-3"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eb4a03fbed87-4" : undefined}>Designated Zik ID selfie</span><StatusBadge>Device-only</StatusBadge></div><p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eb4a03fbed87-5" : undefined}>Encrypted inside this Vault. It is shared only after device authentication through a direct, one-time connection.</p>{selfie&&<div className="flex items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={selfie} alt="Designated Zik ID selfie" className="h-20 w-20 rounded-2xl object-cover"/><Button type="button" variant="ghost" onClick={()=>{setSelfie(undefined);setSelfieCapturedAt(undefined);}}>Remove</Button></div>}<label className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[var(--zk-line-strong)] bg-white px-4 text-sm font-semibold">{selfie?'Choose another selfie':'Choose selfie'}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={e=>void selectSelfie(e.target.files?.[0])}/></label></div>}
      <label className="block text-sm">{profile?'Re-enter passphrase to save edits':'Passphrase (at least 12 characters)'}<input aria-label="Passphrase" type="password" minLength={12} maxLength={1024} required autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)} className="mt-1 w-full rounded-lg border p-3"/></label>
      <Button type="submit" loading={busy}>{exists&&!profile?'Unlock Vault':'Save Vault'}</Button>
    </form>}
    {exists&&<div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={lock} disabled={busy}>Lock Vault</Button><Button variant="danger" onClick={()=>void remove()} disabled={busy}>Delete Vault</Button></div>}
    {!onUnlocked&&<ButtonLink href="/retail-demo" variant="secondary">Try retail form-fill</ButtonLink>}
    <p className="text-xs" data-local-edit={process.env.NODE_ENV === "development" ? "ve-eb4a03fbed87-6" : undefined}>Browser encryption is not hardware-backed storage. A compromised device or page can read unlocked data. JavaScript cannot guarantee memory erasure.</p>
  </Card>;
}

async function resizeSelfie(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 10_000_000) throw new Error('invalid_image');
  const source = await createImageBitmap(file);
  const size = 360;
  const canvas = document.createElement('canvas'); canvas.width=size; canvas.height=size;
  const context = canvas.getContext('2d'); if (!context) throw new Error('canvas_unavailable');
  const side=Math.min(source.width,source.height), sx=(source.width-side)/2, sy=(source.height-side)/2;
  context.drawImage(source,sx,sy,side,side,0,0,size,size); source.close();
  const result=canvas.toDataURL('image/jpeg',0.72);
  if (result.length>250000) throw new Error('image_too_large');
  return result;
}
