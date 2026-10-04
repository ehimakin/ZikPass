"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ZikLogoMark } from "@/components/zik-logo";


type MenuLink = { href: Route; label: string };
type MenuItem = MenuLink | { label: string; children: MenuLink[] };

export function CustomerMenu({ items, pathname }: {
  items: MenuItem[];
  pathname: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [suiteOpen, setSuiteOpen] = useState(false);
  const menuItems: MenuItem[] = [{ href: "/dashboard" as Route, label: "Dashboard" }, ...items];
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
    setSuiteOpen(false);
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
          <Link href="/home" onClick={close} aria-label="Zik home" className="zk-menu-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--zk-focus)]">
            <ZikLogoMark className="h-8 w-8 shrink-0" />
            <h2 id="customer-menu-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-1" : undefined}>Zik</h2>
          </Link>
          <button type="button" onClick={close} aria-label="Close menu"
            className="zk-menu-close">
            <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-2" : undefined}>Close</span><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <nav aria-label="Site menu" className="zk-menu-nav">
          {menuItems.map((item, index) => "children" in item ? (
            <div key={item.label}>
              <button type="button" className="zk-menu-link w-full text-left" aria-expanded={suiteOpen} aria-controls="zik-suite-submenu"
                onClick={() => setSuiteOpen(value => !value)}
                onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)}>
                <span className="zk-menu-index">0{index + 1}</span><span>{item.label}</span><span className="zk-menu-arrow" aria-hidden="true">{suiteOpen ? "−" : "+"}</span>
              </button>
              <ul id="zik-suite-submenu" hidden={!suiteOpen} className="zk-menu-submenu">
                {item.children.map(child => <li key={child.href}>
                  <Link href={child.href} onClick={close} aria-current={pathname === child.href ? "page" : undefined}>
                    <span>{child.label}</span><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-7" : undefined}>↗</span>
                  </Link>
                </li>)}
              </ul>
            </div>
          ) : (
            <Link key={item.href} href={item.href} onClick={close} aria-current={pathname === item.href ? "page" : undefined}
              onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)}
              className="zk-menu-link">
              <span className="zk-menu-index">0{index + 1}</span><span>{item.label}</span><span className="zk-menu-arrow" aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-3" : undefined}>↗</span>
            </Link>
          ))}
        </nav>
        <div className="zk-menu-footer">
          <div className="zk-menu-utility">
            <Link href="/wallet" onClick={close}>Wallet</Link>
            <Link href="/ZikParental" onClick={close} aria-current={pathname === "/ZikParental" ? "page" : undefined}>Zik for Parents</Link>
            <a href="/partner_stores" onClick={close} data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-5" : undefined}>Become a partner store</a>
            <Link href="/affiliates" onClick={close} aria-current={pathname === "/affiliates" ? "page" : undefined}>Zik for businesses</Link>
            <Link href={"/ecosystem" as Route} onClick={close} aria-current={pathname === "/ecosystem" ? "page" : undefined}>The Zik ecosystem</Link>
            <Link href={"/account-recovery/restore" as Route} onClick={close}>Lost phone and card?</Link>
            <Link href="/help" onClick={close}>Help</Link>
          </div>
          <div className="zk-menu-staff">
            <span data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-4" : undefined}>For staff</span>
            <Link href="/dashboard/store/verify" onClick={close}>Verify a customer</Link>
            <Link href="/dashboard/store/purchase" onClick={close}>Sell a Zik Pass</Link>
          </div>
          <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-8319931b3b11-6" : undefined}>Early Access</p>
        </div>
      </dialog>
    </>
  );
}
