import { CustomerShell } from '@/components/customer/customer-shell';
import { AccountRecoveryScreen } from '@/components/customer/account-recovery/recovery-screen';
export const metadata = { title: 'Recovery phrase · Zik', description: 'Protect your account and recover after losing both your phone and Zik Card.' };
export default function AccountRecoveryPage() {
  return <CustomerShell active="wallet" title="Account recovery"><AccountRecoveryScreen /></CustomerShell>;
}
