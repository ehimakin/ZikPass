import { CustomerShell } from '@/components/customer/customer-shell';
import { ValidateScreen } from '@/components/validate/validate-screen';
export const metadata = { title: 'Zik Validate · Get it validated', description: 'Get a document independently verified. Explore the local attestation prototype.' };
export default function ValidatePage() {
  return <CustomerShell active="about" title="Zik Validate"><ValidateScreen /></CustomerShell>;
}
