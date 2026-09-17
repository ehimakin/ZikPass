'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ButtonLink, Card, StatusBadge } from './ui';
import { VaultScreen, fieldLabels } from './vault-screen';
import { parseRequest, encryptDisclosure, selectFields, type DisclosureRequestV1 } from '@/lib/shared/disclosure';
import { type VaultProfileV1, type ProfileField, strictObject, selfEntered } from '@/lib/shared/vault';
import { createPresentationBundle } from '@/lib/client/wallet-client';
async function post(url:string, body:unknown) { const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});if(!response.ok) throw Error();return response.json(); }
export function RetailDemo() {
  const [request,setRequest]=useState<DisclosureRequestV1>();
  const [profile,setProfile]=useState<VaultProfileV1>();
  const [email,setEmail]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('Fictional merchant · no order is placed.');
  const [filled,setFilled]=useState<Partial<Record<ProfileField,string>>>();
  const trigger=useRef<HTMLButtonElement>(null);
  const restoreFocus=useRef(false);
  useEffect(()=>{if(!request&&!busy&&restoreFocus.current){trigger.current?.focus();restoreFocus.current=false;}},[request,busy]);
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{if(request)heading.current?.focus();},[request]);
  const unlocked=useCallback((p:VaultProfileV1|undefined)=>{setProfile(p);if(!p)setEmail(false);},[]);
  async function start(){setBusy(true);try{setRequest(parseRequest(await post('/api/demo-merchant/start',{})));setProfile(undefined);setEmail(false);setFilled(undefined);setMessage('Review this request before sharing.');}catch{setMessage('This disclosure could not be completed. Please start again.');}finally{setBusy(false);}}
  function close(){restoreFocus.current=true;setRequest(undefined);setProfile(undefined);setEmail(false);}
  async function cancel(){if(!request)return;setBusy(true);try{await post('/api/disclosure/cancel',{request_id:request.request_id,state:request.state});setMessage('Cancelled. No details shared.');}catch{setMessage('This disclosure could not be completed. Please start again.');}finally{close();setBusy(false);}}
  async function approve(){if(!request||!profile)return;setBusy(true);try{
    const selected:ProfileField[]=['legal_name','delivery_address',...(email?['email' as const]:[])];
    const envelope=await encryptDisclosure(request,selectFields(request,selected,profile));
    const presentation=await createPresentationBundle(request.challenge);
    const outcome=strictObject(await post('/api/disclosure/approve',{request_id:request.request_id,state:request.state,nonce:request.nonce,envelope,presentation}),['code','state','return_uri']);
    if(outcome.state!==request.state||outcome.return_uri!==request.return_uri)throw Error();
    const result=strictObject(await post('/api/demo-merchant/redeem',{code:outcome.code}),['age','fields']);
    const age=strictObject(result.age,['age_over_18','provenance']);if(age.age_over_18!==true||age.provenance!=='zik_verified')throw Error();
    const fields=strictObject(result.fields,['legal_name','delivery_address'],email?['email']:[]);
    setFilled(Object.fromEntries(Object.entries(fields).map(([f,v])=>[f,selfEntered(v).value])));setMessage('Checkout filled. Age 18+ — Zik verified.');close();
  }catch{setMessage('This disclosure could not be completed. Please start again.');close();}finally{setBusy(false);}}
  return <div className="mx-auto max-w-[460px] space-y-4 px-4 py-6">
    <Card className="space-y-4 p-5"><p className="text-xs uppercase tracking-widest" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-1" : undefined}>Fictional retail demo</p><h1 className="text-2xl font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-2" : undefined}>Harbour &amp; Pine</h1><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-3" : undefined}>Evening hamper · £24.00</p><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-4" : undefined}>Delivery checkout</p><p role="status" aria-live="polite">{message}</p>
      {!request&&<button ref={trigger} disabled={busy} onClick={()=>void start()} className="min-h-12 rounded-full bg-ink px-6 py-3 font-semibold text-white disabled:opacity-50" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-5" : undefined}>Fill with Zik</button>}
      {filled&&<div className="space-y-3"><StatusBadge tone="positive">Age 18+ · Zik verified</StatusBadge>{Object.entries(filled).map(([f,value])=><label key={f} className="block text-sm">{fieldLabels[f as ProfileField]} <StatusBadge>Self-entered</StatusBadge><textarea aria-label={`Checkout ${fieldLabels[f as ProfileField]}`} value={value} readOnly className="mt-1 w-full rounded-lg border p-3"/></label>)}<p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-6" : undefined}>No purchase is submitted in this demo.</p></div>}
    </Card>
    {request&&<section aria-label="Disclosure consent" className="space-y-4">
      <Card className="space-y-3 p-5"><h2 tabIndex={-1} ref={heading} className="text-xl font-bold">Share with {request.display_name}?</h2><p>{request.purpose}</p><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-7" : undefined}>Request expires in two minutes. Protocol v1.</p><h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-8" : undefined}>Required</h3><p>Age over 18 <StatusBadge tone="positive">Zik verified</StatusBadge></p><p>Legal name and delivery address <StatusBadge>Self-entered</StatusBadge></p><h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-9" : undefined}>Optional · off by default</h3><label className="flex gap-2"><input type="checkbox" checked={email} disabled={!profile?.email||busy} onChange={e=>setEmail(e.target.checked)}/>Share email · Self-entered</label><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-10" : undefined}>Not shared: date of birth, photo, ID number, raw credential or holder key. Name and address are not Zik-verified.</p><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-11" : undefined}>Approved profile fields are encrypted for this merchant. This co-hosted demo merchant can read them after approval.</p></Card>
      <VaultScreen onUnlocked={unlocked}/>
      {profile&&<Card className="space-y-2 p-5"><h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-bdc25db6bbd1-12" : undefined}>You will share</h3>{(['legal_name','delivery_address',...(email?['email']:[])] as ProfileField[]).map(f=><p key={f} className="break-words">{fieldLabels[f]}: {profile[f]?.value} <StatusBadge>Self-entered</StatusBadge></p>)}</Card>}
      <div className="flex gap-3"><Button disabled={!profile||busy} loading={busy} onClick={()=>void approve()}>Approve and fill</Button><Button variant="secondary" disabled={busy} onClick={()=>void cancel()}>Cancel</Button></div>
    </section>}
    <ButtonLink href="/vault-legacy" variant="ghost">My Vault</ButtonLink><ButtonLink href="/affiliate-demo" variant="ghost">Try age-only</ButtonLink>
  </div>;
}
