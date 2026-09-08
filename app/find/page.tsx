import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { StoreFinder } from "@/components/customer/store-finder";

export default async function FindStorePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.entry) ? params.entry[0] : params.entry;
  const entry = raw === "retail_card" ? "retail_card" : undefined;

  return (
    <CustomerShell active="find">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">
          {entry === "retail_card" ? "Where did you buy your card?" : "Find a store"}
        </h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]">
          {entry === "retail_card"
            ? "Pick the store you bought your Zik Pass card at - staff there can do the ID check."
            : "Choose where to get verified in person."}
        </p>
      </div>
      <Suspense fallback={null}>
        <StoreFinder selectMode entry={entry} />
      </Suspense>
    </CustomerShell>
  );
}
