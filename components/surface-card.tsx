import type { ReactNode } from "react";
import clsx from "clsx";

export function SurfaceCard({
  title,
  subtitle,
  className,
  children
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx("rounded-[28px] border border-white/80 bg-white/85 p-6 shadow-panel", className)}>
      <div className="mb-5">
        <h2 className="font-heading text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-ink/65">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
