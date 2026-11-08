export function ValidationWorkflow() {
  return <ol className="my-5 space-y-3" aria-label="Zik Validate workflow">
    {[
      ['YOU', 'Upload document'], ['ZIK', 'Understand what’s required'],
      ['VERIFIER', 'Review + validate'], ['ZIK VALIDATION', 'Returned to you with evidence of who validated it, what they confirmed and when.']
    ].map(([who, what], i) => <li key={who}>
      {i > 0 && <p aria-hidden="true" className="mb-3 pl-4 text-xl" data-local-edit={process.env.NODE_ENV === "development" ? "ve-32623c6abfa7-1" : undefined}>↓</p>}
      <div className="rounded-2xl bg-[var(--zk-sunken)] p-4"><p className="text-xs font-bold tracking-widest">{who}</p><p className="mt-1 text-sm">{what}</p></div>
    </li>)}
  </ol>;
}
