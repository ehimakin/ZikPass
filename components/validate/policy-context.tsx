import { documentTypes, jurisdictions, recipients, type RequirementContext } from '@/lib/validate/policy';

export const emptyContext: RequirementContext = { recipientId: '', documentType: '', jurisdiction: '' };

export function PolicyContext({ value, onChange }: {
  value: RequirementContext;
  onChange: (context: RequirementContext) => void;
}) {
  return (
    <fieldset className="space-y-4 rounded-2xl bg-[var(--zk-sunken)] p-5">
      <legend className="font-bold">Where is this document going?</legend>
      <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2d255cc0cdcf-1" : undefined}>Choose a fictional recipient scenario. These example rules do not describe real organisations or legal acceptance.</p>
      {([
        ['recipientId', 'Receiving organisation', recipients],
        ['documentType', 'Document type', documentTypes],
        ['jurisdiction', 'Jurisdiction', jurisdictions]
      ] as const).map(([key, label, options]) => (
        <label key={key} className="block text-sm font-semibold">
          {label}
          <select
            className="mt-2 w-full rounded-xl border border-[var(--zk-line-strong)] bg-[var(--zk-card)] p-3"
            value={value[key]}
            onChange={event => onChange({ ...value, [key]: event.target.value })}
          >
            <option value="">Select {label.toLowerCase()}</option>
            {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            <option value="unlisted">Not listed / not sure</option>
          </select>
        </label>
      ))}
      <p className="text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-2d255cc0cdcf-2" : undefined}>Try Northstar College + Passport copy + England and Wales. Changing the recipient to Harbour Services narrows the example match to a notary.</p>
    </fieldset>
  );
}
