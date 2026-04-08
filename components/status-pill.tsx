import type { ReactNode } from "react";
import clsx from "clsx";

const tones = {
  good: "bg-teal/20 text-ink",
  warn: "bg-blush/45 text-ink",
  neutral: "bg-ink/8 text-ink/80"
};

export function StatusPill({
  tone = "neutral",
  children
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}
