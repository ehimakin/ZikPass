"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ButtonLink, Card, StatusBadge } from '@/components/customer/ui';
import type { PublicTicket } from '@/lib/shared/support/model';
import { label } from '@/lib/shared/support/model';
import { containsSupportSecret } from '@/lib/shared/support/validation';

export function TicketThread({ id }: { id: string }) {
  const [key, setKey] = useState('');
  const [ticket, setTicket] = useState<PublicTicket>();
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const retry = useRef<{ requestId: string; body: string } | undefined>(undefined);
  useEffect(() => {
    let live = true;
    async function open() {
      try {
        const supplied = new URLSearchParams(location.hash.slice(1)).get('key');
        if (supplied) { history.replaceState(null, '', location.pathname); if (!/^[A-Za-z0-9_-]{43}$/.test(supplied)) throw new Error('The private link is invalid.'); sessionStorage.setItem(`zik-support:${id}`, supplied); }
        const access = supplied ?? sessionStorage.getItem(`zik-support:${id}`);
        if (!access) throw new Error('Open the private link saved when you created this ticket. A ticket reference alone cannot grant access.');
        const response = await fetch(`/api/support/tickets/${id}`, { cache: 'no-store', headers: { Authorization: `Bearer ${access}` } });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? 'Could not open this ticket.');
        if (live) { setKey(access); setTicket(value); }
      } catch (reason) { if (live) setError(reason instanceof Error ? reason.message : 'Could not open the ticket.'); } finally { if (live) setLoading(false); }
    }
    void open(); return () => { live = false; };
  }, [id]);
  async function refresh() {
    setBusy(true); setError('');
    try { const response = await fetch(`/api/support/tickets/${id}`, { cache: 'no-store', headers: { Authorization: `Bearer ${key}` } }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTicket(data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Refresh failed.'); } finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (busy || !ticket) return;
    if (containsSupportSecret(reply)) { setError('Remove recovery words, passphrases, PINs and private keys before sending.'); return; }
    setBusy(true); setError('');
    if (!retry.current || retry.current.body !== reply) retry.current = { requestId: crypto.randomUUID(), body: reply };
    try {
      const response = await fetch(`/api/support/tickets/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ ...retry.current, version: ticket.version }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? 'Reply could not be sent.');
      setTicket(data); setReply(''); retry.current = undefined;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Reply could not be sent.'); } finally { setBusy(false); }
  }
  async function copyLink() {
    const link = `${location.origin}/help/ticket/${id}#key=${key}`;
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setShareLink(link); }
  }
  return <div className="space-y-5 py-5">
    <h1 className="text-3xl font-extrabold">Your help ticket</h1>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
    {loading ? <p role="status">Opening your private conversation…</p> : ticket ? <>
      <Card className="space-y-3 !rounded-2xl p-5"><StatusBadge>{label(ticket.status)}</StatusBadge><h2 className="text-xl font-bold">{ticket.subject}</h2><p className="break-all font-mono text-xs text-[var(--zk-text-soft)]">{ticket.id}</p><p className="text-sm leading-relaxed">Save your private link somewhere safe. Anyone with it can read and reply to this ticket. Replies appear here; email notifications are not enabled.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => void copyLink()}>{copied ? 'Private link copied' : 'Copy private ticket link'}</Button><Button variant="ghost" loading={busy} onClick={() => void refresh()}>Check for replies</Button></div>{shareLink ? <label className="block text-xs font-semibold">Copy and save this private link<input readOnly className="mt-2 w-full rounded-lg border p-2" value={shareLink} onFocus={e => e.target.select()} /></label> : null}</Card>
      {ticket.resolution ? <Card className="!rounded-2xl p-5"><h3 className="font-bold">Support outcome</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{ticket.resolution}</p></Card> : null}
      <ol className="space-y-3" aria-label="Ticket conversation">{ticket.messages.map(m => <li key={m.id} className={`rounded-2xl border border-[var(--zk-line)] p-5 ${m.author === 'admin' ? 'bg-emerald-50' : 'bg-white'}`}><div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{m.author === 'admin' ? 'Zik Support' : 'You'}</strong><time>{new Date(m.createdAt).toLocaleString()}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p></li>)}</ol>
      <form onSubmit={e => void send(e)} className="space-y-3"><label className="block text-sm font-bold">Reply to support<textarea className="mt-2 w-full rounded-xl border border-[var(--zk-line-strong)] bg-white p-3 text-base" rows={5} required maxLength={6000} value={reply} onChange={e => setReply(e.target.value)} /></label><p className="text-xs text-[var(--zk-text-soft)]">Do not send recovery words, passphrases, PINs, ID documents or payment details. Replying to a resolved or closed ticket reopens it.</p><Button type="submit" loading={busy}>Send reply</Button></form>
    </> : null}
    <ButtonLink href="/help" variant="ghost">Back to help</ButtonLink>
  </div>;
}
