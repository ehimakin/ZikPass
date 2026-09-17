import { Suspense } from "react";
import { CustomerShell } from "@/components/customer/customer-shell";
import { StoreFinder } from "@/components/customer/store-finder";

export default function FindStorePage() {
  return (
    <CustomerShell active="find">
      <div className="mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--zk-text)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-81beef8f0747-1" : undefined}>
          Find a store
        </h1>
        <p className="mt-1 text-[14px] text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-81beef8f0747-2" : undefined}>
          Choose where to get verified in person.
        </p>
      </div>
      <Suspense fallback={null}>
        <StoreFinder selectMode />
      </Suspense>
    </CustomerShell>
  );
}
