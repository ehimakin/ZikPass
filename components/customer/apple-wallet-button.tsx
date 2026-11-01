"use client";

import { useId } from "react";
import { Button } from "./ui";

export function AppleWalletButton({ available, product }: { available: boolean; product: "Zik Card" | "Zik Pass" }) {
  const descriptionId = useId();

  return (
    <div className="space-y-2">
      {available ? (
        <a
          href="/api/wallet/apple/demo"
          aria-describedby={descriptionId}
          className="zk-button inline-flex min-h-[44px] items-center justify-center rounded-full bg-ink px-5 text-[15px] font-semibold text-white hover:bg-[#1c2839] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zk-focus)] focus-visible:ring-offset-2"
         data-local-edit={process.env.NODE_ENV === "development" ? "ve-2727035791ec-1" : undefined}>
          Add to Apple Wallet
        </a>
      ) : (
        <Button disabled aria-describedby={descriptionId}>Add to Apple Wallet</Button>
      )}
      <p id={descriptionId} className="text-sm text-[var(--zk-text-soft)]">
        {available
          ? `Adds a demo preview only, not your ${product} credential. Open in Safari on iPhone to add it.`
          : `Apple Wallet is not available for your ${product} yet.`}
      </p>
    </div>
  );
}
