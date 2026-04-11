import clsx from "clsx";

export function ZikLogoMark({
  className
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={clsx("text-ink", className)}
    >
      <rect
        x="18"
        y="18"
        width="64"
        height="64"
        rx="14"
        transform="rotate(45 50 50)"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path
        d="M50 23V77"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M46 34L30 50H46"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M54 50H70L54 66"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ZikLogoLockup({
  className,
  subdued = false
}: {
  className?: string;
  subdued?: boolean;
}) {
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div
        className={clsx(
          "inline-flex h-11 w-11 items-center justify-center rounded-2xl border",
          subdued ? "border-ink/10 bg-white/80" : "border-white/60 bg-white/82"
        )}
      >
        <ZikLogoMark className="h-7 w-7" />
      </div>
      <div>
        <p className="font-heading text-xl font-semibold tracking-tight text-ink">Zik Pass</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/50">
          Private over-18 verification
        </p>
      </div>
    </div>
  );
}
