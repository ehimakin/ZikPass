"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ZikLogoMark } from "@/components/zik-logo";
import { environmentBadgeLabel } from "@/lib/shared/demo-environment";

export function CustomerMenu({ items, pathname }: {
  items: Array<{ href: Route; label: string }>;
  pathname: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    const previousOverflow = document.body.style.overflow;
    panel?.showModal();
    document.body.style.overflow = "hidden";
    // Land focus on the first menu link rather than the close button.
    panel?.querySelector<HTMLElement>("nav a")?.focus();
    return () => {
      if (panel?.open) panel.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
    // Return focus to the trigger after the dialog has torn down.
    setTimeout(() => trigger.current?.focus(), 0);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="customer-menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--zk-line)] text-[var(--zk-text)] transition-colors hover:bg-[var(--zk-sunken)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--zk-focus)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        id="customer-menu"
        aria-labelledby="customer-menu-title"
        onCancel={close}
        onClose={close}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.target === event.currentTarget &&
            (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) {
            close();
          }
        }}
        className="m-auto max-h-[calc(100dvh-32px)] w-[calc(100%_-_32px)] max-w-[400px] overflow-y-auto rounded-[var(--zk-r-xl)] border border-[var(--zk-line)] bg-[var(--zk-canvas)] p-5 text-[var(--zk-text)] shadow-[var(--zk-shadow-sheet)] backdrop:bg-[rgba(14,23,38,0.45)] backdrop:backdrop-blur-sm"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <ZikLogoMark className="zk-logo-float h-8 w-8 shrink-0" />
          <h2 id="customer-menu-title" className="text-lg font-extrabold tracking-tight">Zik Pass menu</h2>
          <button type="button" onClick={close} aria-label="Close menu"
            className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--zk-sunken)] text-[var(--zk-text-soft)] hover:text-[var(--zk-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Site menu" className="grid gap-2">
          {items.map((item) => (
            <Link key={item.href} href={item.href} onClick={close} aria-current={pathname === item.href ? "page" : undefined}
              className={`flex min-h-12 items-center justify-between rounded-[var(--zk-r-md)] px-4 py-3 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zk-focus)] ${pathname === item.href ? "bg-[var(--zk-accent)] text-[var(--zk-text-on-accent)]" : "bg-[var(--zk-card)] hover:bg-[var(--zk-sunken)]"}`}>
              {item.label}<span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
        <div className="mt-5 border-t border-[var(--zk-line)] pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--zk-text-soft)]">For staff</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
            <Link href="/verify" onClick={close} className="py-2 hover:underline">Retail verify</Link>
            <Link href="/store" onClick={close} className="py-2 hover:underline">Store demo</Link>
          </div>
          <p className="mt-4 text-xs text-[var(--zk-text-soft)]">{environmentBadgeLabel()}</p>
        </div>
      </dialog>
    </>
  );
}
