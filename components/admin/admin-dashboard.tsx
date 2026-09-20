"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ZikLogoMark } from '@/components/zik-logo';
import { Button, ButtonLink } from '@/components/customer/ui';
import { BUG_STATUSES, PRIORITIES, RECOVERY_OUTCOMES, TICKET_STATUSES, isActive, label, type AdminTicket, type Bug, type Workspace } from '@/lib/shared/support/model';
import { REPLY_TEMPLATES, SUPPORT_PLAYBOOK, SUPPORT_POLICY_VERSION } from '@/lib/shared/support/policy';
import { containsSupportSecret } from '@/lib/shared/support/validation';

type Session = { actor: string; csrf: string; expiresAt: number };
type Tab = 'tickets' | 'recovery' | 'bugs' | 'policy' | 'audit';
type Mutation = (value: Record<string, unknown>) => Promise<boolean>;
const control = 'mt-1.5 w-full rounded-xl border border-[var(--zk-line-strong)] bg-white px-3 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)]';
const panel = 'rounded-2xl border border-[var(--zk-line)] bg-white';
const date = (value: string) => new Date(value).toLocaleString();
function Field({ title, children }: { title: string; children: ReactNode }) { return <label className="block text-sm font-semibold">{title}{children}</label>; }
function Tag({ value }: { value: string }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${value === 'urgent' ? 'bg-red-100 text-red-800' : value === 'resolved' || value === 'closed' ? 'bg-emerald-50 text-emerald-800' : 'bg-[#eeeee7] text-[#55606f]'}`}>{label(value)}</span>; }
async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error ?? 'Request failed.') as Error & { status: number }; error.status = response.status; throw error; }
  return result;
}

export function AdminDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [configured, setConfigured] = useState(true);
  const [storageReady, setStorageReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [data, setData] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>('tickets');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selected, setSelected] = useState('');
  const [bugTitle, setBugTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let live = true;
    void request('/api/admin/session').then(async result => {
      if (!live) return; setConfigured(result.configured); setStorageReady(result.storageReady); setSession(result.session);
      if (result.session) { const workspace = await request('/api/admin/workspace'); if (live) setData(workspace); }
    }).catch(reason => { if (live) setError(reason.message); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  function failure(reason: unknown) {
    if ((reason as { status?: number })?.status === 401) { setSession(null); setData(null); }
    setError(reason instanceof Error ? reason.message : 'The request could not complete.');
  }
  async function refresh() { setBusy(true); setError(''); try { setData(await request('/api/admin/workspace')); } catch (reason) { failure(reason); } finally { setBusy(false); } }
  const mutate: Mutation = async value => {
    if (!session || busy) return false;
    if (Object.values(value).some(item => typeof item === 'string' && containsSupportSecret(item))) { setError('Remove secrets before saving.'); return false; }
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await request('/api/admin/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': session.csrf }, body: JSON.stringify(value) });
      setData(await request('/api/admin/workspace'));
      setNotice(value.action === 'sync_errors' ? `${result.count} new error reports imported.` : value.action === 'retention' ? `${result.removed} expired closed tickets removed.` : 'Saved.');
      return true;
    } catch (reason) { failure(reason); return false; } finally { setBusy(false); }
  };
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const value = await request('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }); setSession(value); setPassword(''); setData(await request('/api/admin/workspace')); }
    catch (reason) { setPassword(''); failure(reason); } finally { setBusy(false); }
  }
  async function logout() {
    if (!session) return; setBusy(true);
    try { await request('/api/admin/session', { method: 'DELETE', headers: { 'x-csrf-token': session.csrf } }); setSession(null); setData(null); setNotice(''); }
    catch (reason) { failure(reason); } finally { setBusy(false); }
  }
  function switchTab(value: Tab) { setTab(value); setSelected(''); setQuery(''); setStatusFilter('active'); }
  const tickets = (data?.tickets ?? []).filter(t => (tab !== 'recovery' || t.category === 'recovery') && (statusFilter === 'all' || (statusFilter === 'active' ? isActive(t.status) : t.status === statusFilter)) && (priorityFilter === 'all' || t.priority === priorityFilter) && `${t.id} ${t.subject} ${t.contactEmail ?? ''} ${t.errorReference ?? ''} ${t.assignee}`.toLowerCase().includes(query.toLowerCase()));
  const ticket = tickets.find(t => t.id === selected) ?? tickets[0];
  const bugs = (data?.bugs ?? []).filter(b => `${b.id} ${b.title} ${b.route} ${b.references.join(' ')}`.toLowerCase().includes(query.toLowerCase()) && (priorityFilter === 'all' || b.priority === priorityFilter));
  const bug = bugs.find(b => b.id === selected) ?? bugs[0];
  const open = data?.tickets.filter(t => isActive(t.status)) ?? [];
  const overdue = open.filter(t => !t.firstResponseAt && Date.parse(t.dueAt) < Date.now()).length;

  return <div className="min-h-screen bg-[var(--zk-canvas)] text-[var(--zk-text)]">
    <header className="border-b border-[var(--zk-line)] bg-white"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/admin" className="flex items-center gap-3"><ZikLogoMark padlock className="h-9 w-9" /><div><p className="text-xl font-extrabold">Zik Support</p><p className="text-xs font-semibold text-[var(--zk-text-soft)]">ADMIN WORKSPACE</p></div></Link>
      <div className="flex items-center gap-3"><ButtonLink href="/help" variant="ghost">Customer help</ButtonLink>{session ? <><span className="hidden text-sm text-[var(--zk-text-soft)] sm:block">{session.actor}</span><Button disabled={busy} variant="secondary" onClick={() => void logout()}>Sign out</Button></> : <Tag value="restricted_access" />}</div>
    </div></header>
    <main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8">
      {error ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}
      {notice ? <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {loading ? <p role="status">Checking admin session…</p> : !session ? <section className={`${panel} mx-auto max-w-lg p-7`}>
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--zk-text-soft)]">For the Zik team</p><h1 className="mt-3 text-3xl font-extrabold">A clearer view of every request.</h1><p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">Manage support, recovery guidance and engineering follow-up in one place.</p>
        {!configured ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm"><strong>Set up your admin login first.</strong><p className="mt-2">On the server, run <code>npm run admin:setup</code>, choose your credentials, then restart the app. There is no default admin password.</p></div> : null}
        {!storageReady ? <p className="mt-4 text-sm text-red-800">Durable support storage must be configured before signing in.</p> : null}
        <form onSubmit={login} className="mt-6 space-y-4"><Field title="Admin username"><input className={control} value={username} onChange={e => setUsername(e.target.value)} required maxLength={80} autoComplete="username" /></Field><Field title="Admin password"><input type="password" className={control} value={password} onChange={e => setPassword(e.target.value)} required maxLength={256} autoComplete="current-password" /></Field><Button type="submit" size="lg" disabled={!configured || !storageReady} loading={busy}>Sign in</Button></form><p className="mt-4 text-xs text-[var(--zk-text-soft)]">Sessions end after 30 minutes of inactivity, or eight hours at most.</p>
      </section> : !data ? <Button onClick={() => void refresh()}>Load workspace</Button> : <>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--zk-text-soft)]">Support operations</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Keep customers moving.</h1><p className="mt-2 text-sm text-[var(--zk-text-soft)]">Triage, respond, investigate and verify the outcome.</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={busy} onClick={() => void mutate({ action: 'sync_errors' })}>Import error reports</Button><Button variant="secondary" loading={busy} onClick={() => void refresh()}>Refresh</Button></div></div>
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{[[open.length, 'Open requests'], [open.filter(t => !t.assignee).length, 'Unassigned'], [overdue, 'First response overdue'], [data.bugs.filter(b => b.status !== 'resolved').length, 'Active bugs']].map(([count, title]) => <div key={title} className={`${panel} p-4`}><p className="text-3xl font-extrabold">{count}</p><p className="mt-1 text-xs font-semibold text-[var(--zk-text-soft)]">{title}</p></div>)}</div>
        <nav aria-label="Admin views" className="mb-5 flex flex-wrap gap-2 border-b border-[var(--zk-line)] pb-4">{(['tickets', 'recovery', 'bugs', 'policy', 'audit'] as Tab[]).map(value => <button key={value} onClick={() => switchTab(value)} aria-current={tab === value ? 'page' : undefined} className={`min-h-11 rounded-full px-5 text-sm font-bold ${tab === value ? 'bg-[var(--zk-ink)] text-white' : 'bg-white text-[var(--zk-text-soft)]'}`}>{value === 'policy' ? 'Policy & playbook' : label(value)}</button>)}</nav>
        {tab === 'tickets' || tab === 'recovery' || tab === 'bugs' ? <>
          <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_150px]"><label className="sr-only" htmlFor="support-search">Search workspace</label><input id="support-search" className={control} placeholder="Search reference, subject or owner…" value={query} onChange={e => setQuery(e.target.value)} />{tab !== 'bugs' ? <select aria-label="Ticket status filter" className={control} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="active">Active tickets</option><option value="all">All statuses</option>{TICKET_STATUSES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select> : <div />}<select aria-label="Priority filter" className={control} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="all">All priorities</option>{PRIORITIES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></div>
          {tab === 'recovery' ? <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed"><strong>Guide recovery; never bypass it.</strong> Customers enter their words only at <code>/account-recovery/restore</code>. A ticket or contact email is not ownership proof. Admins cannot decrypt a backup or replace its recovery key. Recovery service: {data.recoveryAvailable ? 'available' : 'unavailable — check durable storage configuration'}.</div> : null}
          {tab === 'bugs' ? <form className="mb-4 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void mutate({ action: 'create_bug', title: bugTitle }).then(ok => { if (ok) setBugTitle(''); }); }}><input aria-label="New bug title" className={`${control} !mt-0 min-w-48 flex-1`} placeholder="New bug title…" value={bugTitle} onChange={e => setBugTitle(e.target.value)} required maxLength={160} /><Button type="submit" disabled={busy}>Add bug</Button></form> : null}
          <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section aria-label={tab === 'bugs' ? 'Bug queue' : 'Ticket queue'} className={`${panel} overflow-hidden`}>
              {(tab === 'bugs' ? bugs : tickets).length === 0 ? <div className="p-7 text-sm text-[var(--zk-text-soft)]">Nothing matches this view.</div> : tab === 'bugs' ? bugs.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className={`block w-full border-b border-[var(--zk-line)] p-4 text-left last:border-0 ${bug?.id === item.id ? 'bg-[#f0f5db]' : 'hover:bg-[#f8f8f3]'}`}><div className="mb-2 flex gap-2"><Tag value={item.priority} /><Tag value={item.status} /></div><p className="font-bold">{item.title}</p><p className="mt-2 text-xs text-[var(--zk-text-soft)]">{item.occurrences} errors · {item.ticketIds.length} linked tickets</p></button>) : tickets.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className={`block w-full border-b border-[var(--zk-line)] p-4 text-left last:border-0 ${ticket?.id === item.id ? 'bg-[#f0f5db]' : 'hover:bg-[#f8f8f3]'}`}><div className="mb-2 flex flex-wrap gap-2"><Tag value={item.priority} /><Tag value={item.status} /></div><p className="font-bold">{item.subject}</p><p className="mt-2 text-xs text-[var(--zk-text-soft)]">{label(item.category)} · {item.assignee || 'Unassigned'}</p>{!item.firstResponseAt && isActive(item.status) && Date.parse(item.dueAt) < Date.now() ? <p className="mt-2 text-xs font-bold text-red-700">First response overdue</p> : null}</button>)}
            </section>
            {tab === 'bugs' ? bug ? <BugDetail key={`${bug.id}:${bug.version}`} bug={bug} busy={busy} mutate={mutate} /> : <EmptyDetail /> : ticket ? <TicketDetail key={`${ticket.id}:${ticket.version}`} ticket={ticket} bugs={data.bugs} actor={session.actor} busy={busy} mutate={mutate} /> : <EmptyDetail />}
          </div>
        </> : tab === 'policy' ? <Policy busy={busy} mutate={mutate} /> : <section className={`${panel} overflow-x-auto p-5`}><h2 className="text-xl font-bold">Audit history</h2><p className="mt-2 text-sm text-[var(--zk-text-soft)]">Latest 500 events. Message content and credentials are never copied into the audit log.</p><table className="mt-5 w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">When</th><th className="p-2">Actor</th><th className="p-2">Action</th><th className="p-2">Record</th></tr></thead><tbody>{data.audit.map(event => <tr key={event.id} className="border-b border-[var(--zk-line)]"><td className="whitespace-nowrap p-2">{date(event.at)}</td><td className="p-2">{event.actor}</td><td className="p-2">{event.action}<p className="text-xs text-[var(--zk-text-soft)]">{event.changes.join(', ')}</p></td><td className="break-all p-2 font-mono text-xs">{event.target}</td></tr>)}</tbody></table></section>}
        <p className="mt-6 text-xs text-[var(--zk-text-soft)]">Snapshot refreshed {date(data.generatedAt)}. Internal response targets are operating goals, not customer guarantees. Replies are delivered inside private tickets; no email is sent.</p>
      </>}
    </main>
  </div>;
}
function EmptyDetail() { return <div className={`${panel} p-8 text-sm text-[var(--zk-text-soft)]`}>Select a request or bug to view its history and next steps.</div>; }

function TicketDetail({ ticket, bugs, actor, busy, mutate }: { ticket: AdminTicket; bugs: Bug[]; actor: string; busy: boolean; mutate: Mutation }) {
  const [draft, setDraft] = useState({ status: ticket.status, priority: ticket.priority, assignee: ticket.assignee, resolution: ticket.resolution, recoveryOutcome: ticket.recoveryOutcome });
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [linkedBug, setLinkedBug] = useState('');
  const [localError, setLocalError] = useState('');
  const pendingMessage = useRef<{ id: string; body: string; visibility: string } | undefined>(undefined);
  async function send(event: FormEvent) { event.preventDefault(); if (containsSupportSecret(message)) { setLocalError('Remove secrets before sending.'); return; } if (!pendingMessage.current || pendingMessage.current.body !== message || pendingMessage.current.visibility !== visibility) pendingMessage.current = { id: crypto.randomUUID(), body: message, visibility }; await mutate({ action: 'reply_ticket', id: ticket.id, version: ticket.version, requestId: pendingMessage.current.id, visibility, body: message }); }
  return <article className="space-y-4">
    <section className={`${panel} p-5 sm:p-6`}>
      <p className="break-all font-mono text-xs text-[var(--zk-text-soft)]">{ticket.id}</p><h2 className="mt-2 text-2xl font-extrabold">{ticket.subject}</h2><div className="mt-3 flex flex-wrap gap-2"><Tag value={ticket.category} /><Tag value={ticket.priority} /><Tag value={ticket.status} /></div>
      <dl className="mt-4 grid gap-2 text-xs text-[var(--zk-text-soft)] sm:grid-cols-2"><div><dt className="font-bold">Opened</dt><dd>{date(ticket.createdAt)}</dd></div><div><dt className="font-bold">First response target</dt><dd>{date(ticket.dueAt)}{ticket.firstResponseAt ? ' · Responded' : ''}</dd></div>{ticket.contactEmail ? <div><dt className="font-bold">Contact email · Unverified</dt><dd className="break-all">{ticket.contactEmail}</dd></div> : null}{ticket.errorReference ? <div><dt className="font-bold">Error reference</dt><dd>{ticket.errorReference}</dd></div> : null}</dl>
      {ticket.diagnostic ? <p className="mt-3 rounded-xl bg-[var(--zk-sunken)] p-3 text-xs">Customer-shared diagnostics: {ticket.diagnostic}</p> : null}
      <form className="mt-5 space-y-4 border-t border-[var(--zk-line)] pt-5" onSubmit={e => { e.preventDefault(); void mutate({ action: 'update_ticket', id: ticket.id, version: ticket.version, ...draft }); }}>
        <div className="grid gap-3 sm:grid-cols-2"><Field title="Status"><select className={control} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as typeof draft.status })}>{TICKET_STATUSES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field><Field title="Priority"><select className={control} value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as typeof draft.priority })}>{PRIORITIES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field></div>
        <Field title="Assigned owner"><div className="flex gap-2"><input className={control} value={draft.assignee} maxLength={80} onChange={e => setDraft({ ...draft, assignee: e.target.value })} /><Button type="button" variant="ghost" onClick={() => setDraft({ ...draft, assignee: actor })}>Assign to me</Button></div></Field>
        {ticket.category === 'recovery' ? <Field title="Recovery handling outcome"><select className={control} value={draft.recoveryOutcome} onChange={e => setDraft({ ...draft, recoveryOutcome: e.target.value as typeof draft.recoveryOutcome })}>{RECOVERY_OUTCOMES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field> : null}
        <Field title="Resolution · Visible to the customer"><textarea className={control} rows={3} maxLength={2000} value={draft.resolution} onChange={e => setDraft({ ...draft, resolution: e.target.value })} placeholder="Required before resolving or closing. Explain the outcome and next steps." /></Field>
        <Button type="submit" disabled={busy}>Save ticket details</Button>
      </form>
      <div className="mt-5 border-t border-[var(--zk-line)] pt-4">{ticket.bugId ? <p className="text-sm font-semibold">Linked engineering issue: {bugs.find(b => b.id === ticket.bugId)?.title ?? ticket.bugId}</p> : <div className="flex flex-wrap gap-2"><select aria-label="Link to existing bug" className={`${control} !mt-0 min-w-40 flex-1`} value={linkedBug} onChange={e => setLinkedBug(e.target.value)}><option value="">Create a new bug from this ticket</option>{bugs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}</select><Button variant="secondary" disabled={busy} onClick={() => void mutate({ action: 'create_bug', ticketId: ticket.id, version: ticket.version, title: ticket.subject, ...(linkedBug ? { bugId: linkedBug } : {}) })}>Link engineering issue</Button></div>}</div>
    </section>
    <section className={`${panel} p-5 sm:p-6`}><h3 className="text-lg font-bold">Conversation & internal notes</h3><ol className="mt-4 space-y-3">{ticket.messages.map(m => <li key={m.id} className={`rounded-xl border p-4 ${m.visibility === 'internal' ? 'border-amber-200 bg-amber-50' : m.author === 'customer' ? 'border-[var(--zk-line)] bg-[#f8f8f4]' : 'border-emerald-100 bg-emerald-50'}`}><div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{m.authorName} · {m.visibility === 'internal' ? 'Internal only' : 'Customer visible'}</strong><time>{date(m.createdAt)}</time></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p></li>)}</ol>
      <form onSubmit={e => void send(e)} className="mt-6 space-y-3"><Field title="Message visibility"><select className={control} value={visibility} onChange={e => setVisibility(e.target.value as 'public' | 'internal')}><option value="public">Reply to customer</option><option value="internal">Internal note — not sent to customer</option></select></Field><select aria-label="Insert response template" className={control} value="" onChange={e => { setMessage(REPLY_TEMPLATES[Number(e.target.value)].body); setVisibility('public'); }}><option value="" disabled>Insert a response template…</option>{REPLY_TEMPLATES.map((t, i) => <option key={t.title} value={i}>{t.title}</option>)}</select><Field title={visibility === 'public' ? 'Customer reply' : 'Internal note'}><textarea className={control} rows={5} required maxLength={6000} value={message} onChange={e => setMessage(e.target.value)} /></Field><p className="text-xs text-[var(--zk-text-soft)]">Never include recovery words, passphrases, PINs or identity documents. Public replies appear in the ticket; no email is sent.</p>{localError ? <p role="alert" className="text-sm text-red-800">{localError}</p> : null}<Button type="submit" disabled={busy}>{visibility === 'public' ? 'Send customer reply' : 'Save internal note'}</Button></form>
    </section>
  </article>;
}

function BugDetail({ bug, busy, mutate }: { bug: Bug; busy: boolean; mutate: Mutation }) {
  const [draft, setDraft] = useState(bug);
  return <form className={`${panel} space-y-4 p-5 sm:p-6`} onSubmit={e => { e.preventDefault(); void mutate({ ...draft, action: 'update_bug' }); }}>
    <p className="break-all font-mono text-xs text-[var(--zk-text-soft)]">{bug.id}</p><h2 className="text-2xl font-extrabold">Investigate & verify</h2><p className="text-xs text-[var(--zk-text-soft)]">{bug.occurrences} reports · Last seen {date(bug.lastSeenAt)}{bug.route ? ` · ${bug.route}` : ''}{bug.operation ? ` · ${bug.operation}` : ''}</p>
    <Field title="Bug title"><input className={control} required maxLength={160} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field title="Bug status"><select className={control} value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Bug['status'] })}>{BUG_STATUSES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field><Field title="Bug priority"><select className={control} value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Bug['priority'] })}>{PRIORITIES.map(v => <option key={v} value={v}>{label(v)}</option>)}</select></Field></div>
    <Field title="Engineering owner"><input className={control} value={draft.assignee} maxLength={80} onChange={e => setDraft({ ...draft, assignee: e.target.value })} /></Field>
    {([['reproduction', 'Steps to reproduce', 5000], ['expected', 'Expected behavior', 2000], ['actual', 'Actual behavior', 2000], ['fixSummary', 'Fix summary', 3000], ['verification', 'Verification evidence / tests', 3000]] as const).map(([key, title, max]) => <Field key={key} title={title}><textarea rows={3} className={control} maxLength={max} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></Field>)}
    <Field title="Change or release link (HTTPS)"><input type="url" className={control} maxLength={500} value={draft.changeUrl} onChange={e => setDraft({ ...draft, changeUrl: e.target.value })} /></Field>
    {bug.changeUrl ? <a className="inline-flex min-h-11 items-center text-sm font-bold underline" href={bug.changeUrl} target="_blank" rel="noopener noreferrer">Open recorded change ↗</a> : null}
    <p className="text-sm text-[var(--zk-text-soft)]">Resolving requires both a fix summary and test evidence. Linked customer tickets stay open until you communicate their outcome.</p><Button type="submit" disabled={busy}>Save bug</Button>
    {bug.references.length ? <details className="border-t pt-3 text-xs"><summary>Error references</summary><ul className="mt-2 space-y-1 font-mono">{bug.references.map(ref => <li key={ref}>{ref}</li>)}</ul></details> : null}
    {bug.ticketIds.length ? <details className="border-t pt-3 text-xs"><summary>Linked ticket references</summary><ul className="mt-2 space-y-1 break-all font-mono">{bug.ticketIds.map(ref => <li key={ref}>{ref}</li>)}</ul></details> : null}
  </form>;
}
function Policy({ busy, mutate }: { busy: boolean; mutate: Mutation }) {
  const [confirmation, setConfirmation] = useState('');
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"><section className={`${panel} p-6`}><p className="text-xs font-bold text-[var(--zk-text-soft)]">POLICY VERSION {SUPPORT_POLICY_VERSION}</p><h2 className="mt-2 text-2xl font-extrabold">A consistent support process.</h2><div className="mt-5 space-y-6">{SUPPORT_PLAYBOOK.map(item => <section key={item.title}><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]">{item.body}</p></section>)}</div></section><aside className={`${panel} space-y-4 p-5`}><h3 className="text-lg font-bold">Retention review</h3><p className="text-sm leading-relaxed">Permanently remove ticket contents and access keys for tickets closed more than 90 days ago, and audit metadata older than 180 days. Open tickets and bug records are preserved. This cannot be undone from the dashboard.</p><Field title="Type REMOVE EXPIRED TICKETS"><input className={control} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" /></Field><Button variant="danger" disabled={busy || confirmation !== 'REMOVE EXPIRED TICKETS'} onClick={() => void mutate({ action: 'retention', confirm: confirmation }).then(ok => { if (ok) setConfirmation(''); })}>Apply retention policy</Button><ButtonLink href="/help/policy" variant="ghost">Customer support policy</ButtonLink></aside></div>;
}
