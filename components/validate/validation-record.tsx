import { CheckMethodSummary } from './check-method';
import { Card, StatusBadge } from '@/components/customer/ui';
import { declineReasons } from '@/lib/validate/policy';
import { verifiers, type ValidationRecord } from '@/lib/validate/model';

export function ValidationDetails({ record }: { record: ValidationRecord }) {
  const verifier = verifiers.find(v => v.id === record.verifierId);
  return <Card className="!rounded-2xl overflow-hidden">
    <div className="bg-ink p-6 text-mist">
      <p className="text-xs font-bold uppercase tracking-widest" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f606b7f9b81d-1" : undefined}>Zik Validate · Prototype</p>
      <h2 className="mt-3 text-2xl font-extrabold">{record.status === 'validated' ? '✓ ZIK VALIDATED' : record.status === 'declined' ? 'Cannot validate' : 'Validation request sent'}</h2>
      <p className="mt-2 text-sm">{record.id}</p>
    </div>
    {record.policy && <div className="px-5 pt-5"><CheckMethodSummary policy={record.policy} completed={record.status === 'validated'} /></div>}
    <dl className="space-y-4 p-5 text-sm">
      {[
        ['Document', record.documentName], ['Validation', record.validationType],
        ['Verifier', verifier ? `${verifier.name} · ${verifier.profession}` : 'Unknown verifier'],
        ['Professional status', 'Verified — simulated, fictional professional'],
        ['Customer', record.customer], ['Statement', record.validationStatement],
        ['Submitted', new Date(record.createdAt).toLocaleString()],
        ...(record.policy ? [
          ['Receiving organisation', record.policy.recipientLabel],
          ['Document type', record.policy.documentLabel],
          ['Jurisdiction', record.policy.jurisdictionLabel],
          ['Requirement reference', `${record.policy.id} · Version ${record.policy.version} · Fictional policy`]
        ] : [['Requirement reference', 'Legacy prototype record — no policy captured']]),
        ...(record.declineReason ? [['Reason for declining', declineReasons[record.declineReason]]] : []),
        ...(record.declinedAt ? [['Declined', new Date(record.declinedAt).toLocaleString()]] : []),
        ...(record.validatedAt ? [['Validated', new Date(record.validatedAt).toLocaleString()]] : []),
        ['Document fingerprint', `SHA-256: ${record.documentHash}`], ['Validation ID', record.id]
      ].map(([label, value]) => <div key={label}><dt className="text-[var(--zk-text-soft)]">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}
      {record.policy && <div>
        <dt className="text-[var(--zk-text-soft)]">{record.status === 'validated' ? 'Evidence confirmed · Simulated' : 'Required evidence checks'}</dt>
        <dd><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{record.policy.evidence.map(check => {
          const evidence = record.evidence?.find(item => item.checkId === check.id);
          return <li key={check.id}>{check.label}{evidence && <span className="block text-xs text-[var(--zk-text-soft)]">Confirmed {new Date(evidence.confirmedAt).toLocaleString()}</span>}</li>;
        })}</ul></dd>
      </div>}
      <div><dt className="sr-only" data-local-edit={process.env.NODE_ENV === "development" ? "ve-f606b7f9b81d-2" : undefined}>Status</dt><dd><StatusBadge tone={record.status === 'validated' ? 'positive' : 'neutral'}>{({ awaiting_verifier: 'Awaiting verifier', under_review: 'Under review', validated: '✓ Validated', declined: 'Declined' })[record.status]}</StatusBadge></dd></div>
    </dl>
  </Card>;
}
