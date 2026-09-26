import type { PolicySnapshot } from '@/lib/validate/policy';

export function CheckMethodSummary({ policy, completed = false }: { policy: PolicySnapshot; completed?: boolean }) {
  const method = policy.checkMethod;
  if (!method) return <p className="text-sm" data-local-edit={process.env.NODE_ENV === "development" ? "ve-50d21072e767-1" : undefined}>Check arrangements were not captured in this older request. Create a new request to confirm how the checks must take place.</p>;
  return (
    <section className="space-y-2 rounded-xl bg-[var(--zk-sunken)] p-4" aria-label="Check arrangements">
      <p className="text-xs font-bold uppercase tracking-widest">
        {method.mode === 'in_person' ? (completed ? 'In-person checks confirmed · Simulated' : 'In-person checks required') : 'Document review · No appointment in this example'}
      </p>
      <h3 className="font-bold">{method.title}</h3>
      <p className="text-sm">{method.instructions}</p>
      {!completed && <p className="text-sm font-semibold">{method.preparation}</p>}
      <p className="text-xs text-[var(--zk-text-soft)]">
        {method.mode === 'in_person'
          ? 'Prototype only: no appointment is booked here. The verifier must confirm completion of the simulated appointment before validating.'
          : 'This is a fictional recipient policy. Actual check arrangements depend on the recipient’s requirements.'}
      </p>
    </section>
  );
}
