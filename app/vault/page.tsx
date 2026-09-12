import { CustomerShell } from '@/components/customer/customer-shell';
import { VaultScreen } from '@/components/customer/vault-screen';
export default function Page() { return <CustomerShell active="pass"><div className="mx-auto max-w-[460px] px-4 py-6"><VaultScreen/></div></CustomerShell>; }
