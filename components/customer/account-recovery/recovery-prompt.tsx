"use client";
import { useEffect, useState } from 'react';
import { ButtonLink, Card } from '@/components/customer/ui';
import { readRecoveryLocal, type RecoveryStatus } from '@/lib/client/account-recovery/local';

export function AccountRecoveryPrompt() {
  const [status, setStatus] = useState<RecoveryStatus>();
  useEffect(() => { let live = true; void readRecoveryLocal<RecoveryStatus>('status').then(value => { if (live) setStatus(value); }).catch(() => {}); return () => { live = false; }; }, []);
  return <Card className="space-y-3 !rounded-2xl p-5">
    <h2 className="text-lg font-bold">{status ? 'Your recovery backup' : 'Protect against losing your phone and card'}</h2>
    <p className="text-sm leading-relaxed text-[var(--zk-text-soft)]">{status ? `Last saved ${new Date(status.savedAt).toLocaleString()}. Update your backup after changing your Vault.` : 'Finish setup with a 24-word recovery phrase and an encrypted backup. A lost-phone messaging card alone cannot restore your account.'}</p>
    <ButtonLink href="/account-recovery" variant="secondary">{status ? 'Manage recovery backup' : 'Set up recovery phrase'}</ButtonLink>
    <ButtonLink href="/account-recovery/restore" variant="ghost">Lost your phone and Zik Card?</ButtonLink>
  </Card>;
}
