import { CheckMethodSummary } from './check-method';
import { Card } from '@/components/customer/ui';
import type { PolicySnapshot } from '@/lib/validate/policy';

export function PolicySummary({ policy }: { policy: PolicySnapshot }) {
  return (
    <Card className="space-y-4 !rounded-2xl p-5">
      <p className="text-xs font-bold uppercase tracking-widest" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5c9746adc399-1" : undefined}>Fictional recipient requirements</p>
      <p className="text-sm">{policy.recipientLabel} · {policy.documentLabel} · {policy.jurisdictionLabel}</p>
      <div><p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5c9746adc399-2" : undefined}>Validation required</p><h2 className="mt-1 text-xl font-bold">{policy.validationType}</h2></div>
      <CheckMethodSummary policy={policy} />
      <div><h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5c9746adc399-3" : undefined}>What the verifier will confirm</h3><p className="mt-2 text-sm">{policy.statement}</p></div>
      <div><h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5c9746adc399-4" : undefined}>Eligible professions in this example</h3><p className="mt-2 text-sm">{policy.eligibleProfessions.join(', ')}</p></div>
      <div>
        <h3 className="font-bold" data-local-edit={process.env.NODE_ENV === "development" ? "ve-5c9746adc399-5" : undefined}>Evidence checks required</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{policy.evidence.map(check => <li key={check.id}>{check.label}</li>)}</ul>
      </div>
      <p className="text-xs text-[var(--zk-text-soft)]">Requirement reference: {policy.id} · Version {policy.version}. These requirements will be saved with your request.</p>
    </Card>
  );
}
