"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, ButtonLink, Card, StatusBadge } from '@/components/customer/ui';
import { generateRecoveryPhrase, normalizeRecoveryPhrase } from '@/lib/shared/account-recovery/crypto';
import { loadAccountBackup, restoreAccountBackup, saveAccountBackup, type LoadedBackup } from '@/lib/client/account-recovery/client';
import { readRecoveryLocal, type RecoveryStatus } from '@/lib/client/account-recovery/local';
import { VaultV2 } from '@/lib/client/vault/session';

const inputClass = 'mt-2 w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-3 text-base';
type Mode = 'choose' | 'words' | 'confirm' | 'update' | 'restore' | 'review' | 'saved' | 'restored';

export function AccountRecoveryScreen({ restore = false }: { restore?: boolean }) {
  const [mode, setMode] = useState<Mode>(restore ? 'restore' : 'choose');
  const [phrase, setPhrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [vaultSecret, setVaultSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newConfirmation, setNewConfirmation] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<RecoveryStatus>();
  const [hasVault, setHasVault] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState<LoadedBackup>();

  useEffect(() => {
    let live = true;
    void Promise.all([fetch('/api/account-recovery', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(); return r.json(); }), readRecoveryLocal<RecoveryStatus>('status'), VaultV2.status()])
      .then(([service, saved, vault]) => { if (live) { setAvailable(service.available); setStatus(saved); setHasVault(vault !== 'none'); } })
      .catch(() => { if (live) { setAvailable(false); setError('Could not check recovery storage. Reload to try again.'); } });
    return () => { live = false; };
  }, []);

  function clearSecrets() { setPhrase(''); setConfirmation(''); setVaultSecret(''); setNewSecret(''); setNewConfirmation(''); setLoaded(undefined); setConsent(false); }
  function choose(next: Mode) { clearSecrets(); setError(''); setMode(next); }
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Recovery could not complete. Please retry.'); } finally { setBusy(false); }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (!consent) throw new Error('Confirm you have saved your phrase and agree to the encrypted backup.');
      if (mode === 'confirm' && normalizeRecoveryPhrase(confirmation) !== phrase) throw new Error('The words do not match. Check your saved phrase.');
      const saved = await saveAccountBackup(phrase, vaultSecret);
      setStatus(saved); clearSecrets(); setMode('saved');
    });
  }

  return <div className="space-y-5 py-6">
    <header>
      <StatusBadge>Account recovery</StatusBadge>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{mode === 'restore' || mode === 'review' ? 'Lost your phone and Zik Card?' : 'Your recovery phrase'}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--zk-text-soft)]">Your 24-word recovery phrase is your seed phrase. With an encrypted backup, it lets you recover your saved Vault and replace your digital pass on a new device.</p>
    </header>
    {available === null ? <p role="status">Checking recovery storage…</p> : !available ? <Alert tone="caution" title="Recovery storage unavailable">No new backup can be saved or restored here until durable recovery storage is available. Keep your existing phrase safe.</Alert> : null}
    {error ? <p role="alert" className="rounded-xl bg-[var(--zk-critical-bg)] p-4 text-sm text-[var(--zk-critical)]">{error}</p> : null}
    {mode === 'choose' ? <>
      {status ? <Card className="space-y-3 p-5"><h2 className="text-lg font-bold">Last saved backup</h2><p className="text-sm">{new Date(status.savedAt).toLocaleString()}</p><p className="text-sm text-[var(--zk-text-soft)]">{status.hasVault ? 'Vault documents and details' : 'No Vault in this snapshot'} · {status.hasPass ? 'Digital pass recovery' : 'No pass in this snapshot'}. New documents and changes need an updated backup.</p><Button disabled={!available} onClick={() => choose('update')}>Update encrypted backup</Button></Card> : <Card className="space-y-3 p-5"><h2 className="text-lg font-bold">Finish protecting your account</h2><p className="text-sm leading-relaxed">Generate a phrase, write it down and confirm it. Recovery is only ready after your encrypted backup has been saved successfully.</p><Button disabled={!available} onClick={() => { choose('words'); setPhrase(generateRecoveryPhrase()); }}>Set up recovery phrase</Button><Button variant="ghost" disabled={!available} onClick={() => choose('update')}>I already have a recovery phrase</Button></Card>}
      <Card className="space-y-3 p-5"><h2 className="text-lg font-bold">Lost both?</h2><p className="text-sm leading-relaxed">Use a new device or fresh browser profile. You need the 24 words you saved when enabling account recovery; you do not need your old phone or card.</p><Button disabled={!available} onClick={() => choose('restore')}>Recover with my phrase</Button></Card>
      <p className="text-sm text-[var(--zk-text-soft)]">Lost-phone messaging uses a separate messaging passphrase. It cannot restore your account.</p>
      <ButtonLink href="/wallet/recovery" variant="ghost">Manage lost-phone messaging</ButtonLink>
    </> : null}
    {mode === 'words' ? <Card className="space-y-4 p-5">
      <h2 className="text-xl font-bold">Write down these 24 words, in order</h2>
      <p className="text-sm leading-relaxed">Keep them somewhere separate from your phone and card. Anyone with these words can recover your backed-up account. Zik cannot retrieve the phrase for you. Use this newly generated phrase only for Zik.</p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Your 24 recovery words">{phrase.split(' ').map((word, i) => <li key={i} className="rounded-lg bg-[var(--zk-sunken)] p-2 font-mono text-sm"><span className="mr-2 text-[var(--zk-text-soft)]">{i + 1}.</span>{word}</li>)}</ol>
      <Button onClick={() => setMode('confirm')}>I’ve written them down</Button>
      <p className="text-xs text-[var(--zk-text-soft)]">Not backed up yet. Next, confirm your words and save your encrypted backup.</p>
    </Card> : null}
    {mode === 'confirm' || mode === 'update' ? <form onSubmit={save} className="space-y-4">
      <h2 className="text-xl font-bold">{mode === 'confirm' ? 'Confirm your saved phrase' : 'Enter your existing recovery phrase'}</h2>
      <label className="block text-sm font-semibold">All 24 words, in order<textarea required rows={4} maxLength={512} autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass} value={mode === 'confirm' ? confirmation : phrase} onChange={e => mode === 'confirm' ? setConfirmation(e.target.value) : setPhrase(e.target.value)} /></label>
      {hasVault ? <label className="block text-sm font-semibold">Current Vault passphrase<input required type="password" minLength={12} maxLength={1024} autoComplete="off" className={inputClass} value={vaultSecret} onChange={e => setVaultSecret(e.target.value)} /></label> : null}
      <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]">This saves an encrypted snapshot of your current Vault documents and details, if present, and enables recovery of your issued digital pass. Only encrypted Vault data leaves this browser. Backups currently support up to 32 MB of encrypted data. Lost-phone conversations and physical card replacement are not included.</p>
      <label className="flex gap-3 text-sm leading-relaxed"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />I have saved my phrase away from my phone and card, and agree to store this encrypted backup with Zik.</label>
      <Button type="submit" loading={busy} disabled={!available || !consent}>Save encrypted backup</Button>
    </form> : null}
    {mode === 'restore' ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(async () => { const backup = await loadAccountBackup(phrase); setLoaded(backup); setConsent(false); setMode('review'); }); }}>
      <label className="block text-sm font-semibold">Your 24-word recovery phrase<textarea required rows={4} maxLength={512} autoComplete="off" autoCapitalize="none" spellCheck={false} className={inputClass} value={phrase} onChange={e => setPhrase(e.target.value)} /></label>
      <p className="text-sm text-[var(--zk-text-soft)]">Enter it only on your own replacement device. Your phrase is processed in this browser and is never sent to Zik. A lost-phone messaging passphrase will not work here.</p>
      <Button type="submit" loading={busy} disabled={!available}>Find my encrypted backup</Button>
    </form> : null}
    {mode === 'review' && loaded ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(async () => {
      if (!consent) throw new Error('Confirm the replacement before continuing.');
      if (loaded.contents.vault && newSecret !== newConfirmation) throw new Error('The new Vault passphrases do not match.');
      await restoreAccountBackup(loaded, phrase, newSecret); clearSecrets(); setMode('restored');
    }); }}>
      <Card className="space-y-3 p-5"><h2 className="text-xl font-bold">Review what will be restored</h2><p className="text-sm">Snapshot saved {new Date(loaded.response.savedAt).toLocaleString()}</p><ul className="list-disc space-y-2 pl-5 text-sm"><li>{loaded.contents.vault ? 'Vault details and documents saved in this snapshot.' : 'No Vault was included in this backup.'}</li><li>{loaded.contents.enrollmentId ? 'Your digital pass, bound to a new key on this device. Its original expiry remains unchanged.' : 'No digital pass was included in this backup.'}</li></ul><p className="text-sm">Changes made after this snapshot cannot be restored. Existing data in this browser will not be overwritten.</p></Card>
      {loaded.contents.vault ? <><label className="block text-sm font-semibold">New Vault passphrase<input required type="password" minLength={12} maxLength={1024} autoComplete="new-password" className={inputClass} value={newSecret} onChange={e => setNewSecret(e.target.value)} /></label><label className="block text-sm font-semibold">Confirm new Vault passphrase<input required type="password" minLength={12} maxLength={1024} autoComplete="new-password" className={inputClass} value={newConfirmation} onChange={e => setNewConfirmation(e.target.value)} /></label></> : null}
      <label className="flex gap-3 text-sm leading-relaxed"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />Restore on this device and revoke previous digital-pass devices in Zik’s online verification. This cannot erase data on a lost phone or invalidate checks made offline.</label>
      <p className="text-sm text-[var(--zk-text-soft)]">Physical card replacement still requires a separate process; this app currently has only a card demo. Recovery does not issue a replacement physical card.</p>
      <Button type="submit" loading={busy} disabled={!available || !consent}>Restore on this device</Button>
      <p className="text-xs text-[var(--zk-text-soft)]">If interrupted, retry here with the same phrase. Keep the first new Vault passphrase you chose until recovery completes.</p>
    </form> : null}
    {mode === 'saved' ? <Alert tone="positive" title="Recovery backup saved">Your phrase is confirmed and the encrypted snapshot is saved. Keep the phrase safe and update the backup after adding or changing documents.</Alert> : null}
    {mode === 'restored' ? <Alert tone="positive" title="Recovery completed on this device">Your backed-up data is restored. Any restored pass now uses this device’s new key. Previous pass keys are revoked for Zik online verification. Keep your recovery phrase safe.</Alert> : null}
    {mode === 'saved' || mode === 'restored' ? <div className="flex flex-wrap gap-3"><ButtonLink href="/wallet">Open wallet</ButtonLink><ButtonLink href="/vault" variant="secondary">Open Vault</ButtonLink></div> : null}
    {mode !== 'choose' && mode !== 'saved' && mode !== 'restored' ? <Button variant="ghost" disabled={busy} onClick={() => choose('choose')}>Cancel</Button> : null}
  </div>;
}
