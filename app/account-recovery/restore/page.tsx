import { CustomerShell } from '@/components/customer/customer-shell';
import { AccountRecoveryScreen } from '@/components/customer/account-recovery/recovery-screen';
export const metadata = { title: 'Lost phone and card? · Zik' };
export default function RestoreAccountPage() {
  return <CustomerShell active="wallet" title="Recover account"><AccountRecoveryScreen restore /></CustomerShell>;
}
