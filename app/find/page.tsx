import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { StoreFinder } from "@/components/customer/store-finder";

export default function FindStorePage() {
  return (
    <CustomerShell active="find">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]">
          Find a store
        </h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]">
          Choose where to get verified in person.
        </p>
      </div>
      <Suspense fallback={null}>
        <StoreFinder selectMode />
      </Suspense>
    </CustomerShell>
  );
}
