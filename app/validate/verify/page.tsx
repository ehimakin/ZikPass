import { CustomerShell } from '@/components/customer/customer-shell';
import { VerifyScreen } from '@/components/validate/verify-screen';
export const metadata = { title: 'Check a Zik Validation · Prototype' };
export default function VerifyPage() {
  return <CustomerShell active="about" title="Check a validation" back={{ href: '/validate', label: 'Zik Validate' }}><VerifyScreen /></CustomerShell>;
}
