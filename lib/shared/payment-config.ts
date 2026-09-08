import { runtimeConfig } from "@/lib/shared/config";
import { isLiveEnvironment } from "@/lib/shared/demo-environment";

/**
 * Trusted, server-derived pricing for the pass. The client never sends an
 * amount - it only asks to pay, and the server computes the figure from this.
 */
export interface PassPrice {
  minor: number;
  currency: string;
  /** true when the pass is free and no wallet transaction should occur. */
  free: boolean;
  /** Formatted for display, e.g. "£2.99" or "Free". */
  display: string;
}

export function getPassPrice(): PassPrice {
  const minor = Math.max(0, Math.trunc(runtimeConfig.passIssuancePriceMinor));
  const currency = runtimeConfig.deviceExtensionCurrency || "GBP";
  if (minor === 0) {
    return { minor: 0, currency, free: true, display: "Free" };
  }
  return {
    minor,
    currency,
    free: false,
    display: new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100)
  };
}

/**
 * Which real payment provider, if any, is configured. The Stripe Express
 * Checkout route needs BOTH a publishable key on the client and a secret key
 * on the server, plus an HTTPS payment domain registered with Stripe. When
 * this is not fully configured, the UI must fall back to the clearly-labelled
 * ZikPass demo checkout or pay-at-till - never a fake Apple Pay sheet.
 */
export type PaymentProvider = "stripe" | "none";

export function getServerPaymentProvider(): PaymentProvider {
  if (isLiveEnvironment) return "none"; // no live path ships in this milestone
  if (process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return "stripe";
  }
  return "none";
}

/** Client-visible: is the Stripe publishable key present at all? */
export function hasClientStripeKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}
