"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Route } from "next";
import clsx from "clsx";
import { AlertIcon, CheckIcon, CloseIcon } from "@/components/customer/icons";

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zk-focus)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--zk-canvas)] disabled:cursor-not-allowed disabled:opacity-55";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-[var(--zk-text-on-ink)] hover:bg-[#1c2839] active:bg-[#0b1220]",
  secondary:
    "border border-[var(--zk-line-strong)] bg-[var(--zk-card)] text-[var(--zk-text)] hover:bg-[var(--zk-sunken)]",
  ghost: "text-[var(--zk-text)] hover:bg-[var(--zk-sunken)]",
  danger: "bg-[var(--zk-critical)] text-white hover:bg-[#95201a]"
};

const buttonSizes: Record<ButtonSize, string> = {
  md: "min-h-[44px] px-5 text-[15px]",
  lg: "min-h-[52px] px-6 text-[16px] w-full"
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children
}: {
  href: Route | string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className={clsx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
    >
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  as: Tag = "div"
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={clsx(
        "rounded-[var(--zk-r-lg)] border border-[var(--zk-line)] bg-[var(--zk-card)] shadow-[var(--zk-shadow-card)]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------------------- */
/* Status badge                                                                */
/* -------------------------------------------------------------------------- */

type BadgeTone = "neutral" | "positive" | "caution" | "critical" | "info";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-[var(--zk-sunken)] text-[var(--zk-text-soft)]",
  positive: "bg-[var(--zk-positive-bg)] text-[var(--zk-positive)]",
  caution: "bg-[var(--zk-caution-bg)] text-[var(--zk-caution)]",
  critical: "bg-[var(--zk-critical-bg)] text-[var(--zk-critical)]",
  info: "bg-[var(--zk-info-bg)] text-[#2f4fa3]"
};

export function StatusBadge({
  tone = "neutral",
  children,
  dot = false
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
        badgeTones[tone]
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Alert                                                                       */
/* -------------------------------------------------------------------------- */

export function Alert({
  tone = "info",
  title,
  children,
  action
}: {
  tone?: "info" | "caution" | "critical" | "positive";
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const toneClass = {
    info: "bg-[var(--zk-info-bg)] text-[#2f4fa3]",
    caution: "bg-[var(--zk-caution-bg)] text-[var(--zk-caution)]",
    critical: "bg-[var(--zk-critical-bg)] text-[var(--zk-critical)]",
    positive: "bg-[var(--zk-positive-bg)] text-[var(--zk-positive)]"
  }[tone];
  const Icon = tone === "positive" ? CheckIcon : AlertIcon;
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={clsx("flex gap-3 rounded-[var(--zk-r-md)] p-3.5 text-[14px]", toneClass)}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={clsx(title && "mt-0.5", "leading-snug")}>{children}</div> : null}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Skeleton                                                                    */
/* -------------------------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-[var(--zk-r-sm)] bg-[var(--zk-sunken)]", className)}
      aria-hidden="true"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Bottom sheet / dialog                                                       */
/* -------------------------------------------------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("[data-autofocus], button, a, input")?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-[rgba(14,23,38,0.42)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[calc(100dvh-16px)] w-full max-w-[460px] overflow-y-auto rounded-t-[var(--zk-r-xl)] bg-[var(--zk-card)] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[var(--zk-shadow-sheet)] sm:max-h-[calc(100dvh-32px)] sm:rounded-[var(--zk-r-xl)] sm:pb-5"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-[var(--zk-text)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--zk-text-soft)] hover:bg-[var(--zk-sunken)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/* Section heading                                                             */
/* -------------------------------------------------------------------------- */

export function SectionHeading({
  children,
  action
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--zk-text-faint)]">
        {children}
      </h2>
      {action}
    </div>
  );
}
