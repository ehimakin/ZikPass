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
  const [hovered, setHovered] = useState<number | null>(null);

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
        className="zk-fullscreen-menu"
        data-tone={hovered ?? "idle"}
      >
        <div className="zk-menu-header">
          <div className="zk-menu-brand">
            <ZikLogoMark className="h-8 w-8 shrink-0" />
            <h2 id="customer-menu-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-1" : undefined}>Zik</h2>
          </div>
          <button type="button" onClick={close} aria-label="Close menu"
            className="zk-menu-close">
            <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-2" : undefined}>Close</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Site menu" className="zk-menu-nav">
          {items.map((item, index) => (
            <Link key={item.href} href={item.href} onClick={close} aria-current={pathname === item.href ? "page" : undefined}
              onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)}
              className="zk-menu-link">
              <span className="zk-menu-index">0{index + 1}</span><span>{item.label}</span><span className="zk-menu-arrow" aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-3" : undefined}>↗</span>
            </Link>
          ))}
        </nav>
        <div className="zk-menu-footer">
          <div className="zk-menu-utility">
            <Link href="/pass" onClick={close}>My pass</Link>
            <Link href="/vault" onClick={close} aria-current={pathname === "/vault" ? "page" : undefined}>Vault</Link>
            <Link href="/id" onClick={close} aria-current={pathname === "/id" ? "page" : undefined}>Zik ID</Link>
            <Link href={"/ecosystem" as Route} onClick={close} aria-current={pathname === "/ecosystem" ? "page" : undefined}>The Zik ecosystem</Link>
            <Link href="/help" onClick={close}>Help</Link>
          </div>
          <div className="zk-menu-staff">
            <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-4" : undefined}>For staff</span>
            <Link href="/verify" onClick={close}>Verify a customer</Link>
            <Link href="/verify/purchase" onClick={close}>Sell a Zik Pass</Link>
          </div>
          <p>{environmentBadgeLabel()}</p>
        </div>
      </dialog>
    </>
  );
}
