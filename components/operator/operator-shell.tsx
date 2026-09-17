"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { getStoreById, ZIK_STORES } from "@/lib/shared/stores";
import { environmentBadgeLabel } from "@/lib/shared/demo-environment";
import { ZikLogoMark } from "@/components/zik-logo";

export const OPERATOR_STORE_KEY = "zikpass-operator-store";

export function readOperatorStore(): string {
  try {
    return window.localStorage.getItem(OPERATOR_STORE_KEY) || ZIK_STORES[0].id;
  } catch {
    return ZIK_STORES[0].id;
  }
}

/**
 * Shell for staff-facing screens. Distinct from the customer surface: no
 * bottom tab bar, a "Staff" marker, and a store selector that binds this
 * terminal to one catalogue store. The selected store is sent as
 * `x-zik-store-id` so the server rejects codes from other stores.
 */
export function OperatorShell({
  children,
  title,
  storeId,
  onStoreChange
}: {
  children: ReactNode;
  title: string;
  storeId?: string;
  onStoreChange?: (id: string) => void;
}) {
  const boundStore = getStoreById(storeId);
  return (
    <div className="zk-surface flex min-h-[100dvh] flex-col bg-[var(--zk-canvas)]">
      <header className="border-b border-[var(--zk-line)] bg-[var(--zk-card)]">
        <div className="mx-auto flex w-full max-w-[720px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex items-center gap-2">
            <ZikLogoMark className="zk-logo-float h-7 w-7 shrink-0" />
            <span className="text-[15px] font-extrabold tracking-tight text-[var(--zk-text)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d22c3571f16f-1" : undefined}>
              Zik Pass
            </span>
            <span className="rounded-full bg-[var(--zk-sunken)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d22c3571f16f-2" : undefined}>
              Staff
            </span>
          </span>
          <span className="ml-auto text-[11px] font-semibold text-[var(--zk-text-faint)]">
            {environmentBadgeLabel()}
          </span>
          {storeId && onStoreChange ? (
            <label className="flex w-full items-center gap-2 text-[13px]">
              <span className="text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d22c3571f16f-3" : undefined}>This terminal:</span>
              <select
                value={storeId}
                onChange={(e) => onStoreChange(e.target.value)}
                className="min-h-[36px] flex-1 rounded-[var(--zk-r-sm)] border border-[var(--zk-line-strong)] bg-[var(--zk-card)] px-2 text-[13px] font-semibold text-[var(--zk-text)]"
              >
                {ZIK_STORES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : boundStore ? (
            <div className="flex w-full items-center gap-3 rounded-[var(--zk-r-sm)] bg-[var(--zk-sunken)] px-3 py-2 text-[12px]">
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-d22c3571f16f-4" : undefined}>This terminal</span>
                <span className="block truncate font-bold text-[var(--zk-text)]">{boundStore.name}</span>
              </span>
              <Link href="/store?change=1" className="shrink-0 font-semibold text-[var(--zk-text-soft)] underline underline-offset-2">
                Change store
              </Link>
            </div>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[720px] flex-1 px-4 py-5">
        <h1 className="mb-4 text-[20px] font-extrabold tracking-tight text-[var(--zk-text)]">
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

/** Hook: the store this terminal is bound to, persisted locally. */
export function useOperatorStore(): [string, (id: string) => void] {
  const [storeId, setStoreId] = useState(ZIK_STORES[0].id);
  useEffect(() => {
    setStoreId(readOperatorStore());
  }, []);
  const update = (id: string) => {
    setStoreId(id);
    try {
      window.localStorage.setItem(OPERATOR_STORE_KEY, id);
    } catch {
      /* ignore */
    }
  };
  return [storeId, update];
}
