import clsx from "clsx";

/** Original supplied artwork, cropped by its viewBox without altering the file. */
export function ZikGlyph() {
  return <svg x="29" y="22" width="42" height="56" viewBox="151 20 639 843" preserveAspectRatio="xMidYMid meet">
    <image href="/Z.png" width="888" height="888" />
  </svg>;
}

export function ZikLogoMark({
  className,
  tone = "dark"
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={clsx(tone === "light" ? "text-mist" : "text-ink", className)}
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
      <ZikGlyph />
    </svg>
  );
}

export function ZikLogoLockup({
  className,
  subdued = false,
  stacked = false,
  tone = "dark"
}: {
  className?: string;
  subdued?: boolean;
  stacked?: boolean;
  tone?: "dark" | "light";
}) {
  if (tone === "light") {
    return (
      <div className={clsx(stacked ? "flex flex-col items-center gap-4 text-center" : "flex items-center gap-2.5", className)}>
        <ZikLogoMark tone="light" className={stacked ? "h-[15vw] max-h-16 w-[15vw] max-w-16" : "h-6 w-6"} />
        <p className={clsx("font-heading font-semibold tracking-tight text-mist", stacked ? "text-2xl" : "text-base")} data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b11f56c17d1-1" : undefined}>
          <span className="text-[#91b89b]">Zik</span>{" "}Pass
        </p>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        stacked ? "flex flex-col items-center gap-5 text-center" : "flex items-center gap-3",
        className
      )}
    >
      <div
        className={clsx(
          "inline-flex items-center justify-center border",
          stacked
            ? "h-[min(70vw,16rem)] w-[min(70vw,16rem)] rounded-none"
            : "h-11 w-11 rounded-none",
          subdued ? "border-ink/10 bg-white/80" : "border-white/60 bg-white/82"
        )}
      >
        <ZikLogoMark className={stacked ? "h-[72%] w-[72%]" : "h-7 w-7"} />
      </div>
      <div>
        <p className={clsx("font-heading font-semibold tracking-tight text-ink", stacked ? "text-4xl" : "text-xl")} data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b11f56c17d1-2" : undefined}>
          <span className="text-[#28623c]">Zik</span>{" "}Pass
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/50" data-local-edit={process.env.NODE_ENV === "development" ? "ve-9b11f56c17d1-3" : undefined}>
          Private over-18 verification
        </p>
      </div>
    </div>
  );
}
