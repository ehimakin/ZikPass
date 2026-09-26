import { CustomerShell } from '@/components/customer/customer-shell';
import { ValidateScreen } from '@/components/validate/validate-screen';
import { ButtonLink, Card, StatusBadge } from '@/components/customer/ui';
export const metadata = { title: 'Zik Validate · Zik', description: 'Independent document verification. Coming soon.' };
export default function ValidatePage() {
  return <CustomerShell active="about" title="Zik Validate"><div className="space-y-6 py-6"><StatusBadge>Coming Soon</StatusBadge><h1 className="text-4xl font-extrabold tracking-tight">A second pair of eyes.</h1><p className="text-[var(--zk-text-soft)]">Get documents checked by the right professional.</p><Card className="!rounded-3xl p-6"><ol className="space-y-4 text-sm"><li>01 · Choose a document</li><li>02 · Connect with a verifier</li><li>03 · Keep their confirmation</li></ol></Card><p className="text-sm text-[var(--zk-text-soft)]">From £5.99, depending on the document. Professional checks and bookings are not available yet.</p><ButtonLink href="/vault" variant="secondary">Keep documents in Vault</ButtonLink><details id="how-it-works" className="rounded-2xl border border-[var(--zk-line)] p-4"><summary className="cursor-pointer py-2 text-sm font-semibold">Explore a sample workflow</summary><div className="mt-5"><ValidateScreen /></div></details></div></CustomerShell>;
}
