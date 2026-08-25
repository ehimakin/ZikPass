import type { ReactNode } from "react";
import clsx from "clsx";

export function SurfaceCard({
  title,
  subtitle,
  className,
  dark = false,
  children
}: {
  title: string;
  subtitle?: string;
  className?: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={clsx(
        "rounded-[28px] p-6",
        dark ? "border border-white/8 bg-white/[0.03]" : "border border-white/80 bg-white/85 shadow-panel",
        className
      )}
    >
      <div className="mb-5">
        <h2 className={clsx("font-heading text-xl font-semibold tracking-tight", dark ? "text-mist" : "text-ink")}>
          {title}
        </h2>
        {subtitle ? <p className={clsx("mt-1 text-sm", dark ? "text-mist/50" : "text-ink/65")}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
