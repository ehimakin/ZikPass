import type { ReactNode } from "react";
import clsx from "clsx";

const tones = {
  good: "bg-teal/20 text-ink",
  warn: "bg-blush/45 text-ink",
  neutral: "bg-ink/8 text-ink/80"
};

const darkTones = {
  good: "bg-lime/15 text-lime",
  warn: "bg-[#f8c8b4]/15 text-[#f8c8b4]",
  neutral: "bg-white/8 text-mist/70"
};

export function StatusPill({
  tone = "neutral",
  surface = "light",
  children
}: {
  tone?: keyof typeof tones;
  surface?: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex max-w-full break-words rounded-full px-3 py-1 text-center text-xs font-medium",
        surface === "dark" ? darkTones[tone] : tones[tone]
      )}
    >
      {children}
    </span>
  );
}
