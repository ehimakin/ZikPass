/** Product prices and acquisition routes. Finance is a separate future route. */
export function getProductCatalogue(_passDisplayPrice: string) {
  void _passDisplayPrice;
  return [
    { name: "Digital Zik Pass", promise: "Check your age in store. Keep your pass on your phone.", status: "Early Access", displayPrice: "99p one-off · Free during Early Access", available: true, destination: "/get-pass", detail: "An in-person ID check at a participating store. No finance check required." },
    { name: "Physical Zik Card", promise: "Pick up your card. Get checked in person.", status: "In store", displayPrice: "£2.99 · Keep your card for life", available: false, destination: "/shop", detail: "Purchased and activated at participating locations." },
    { name: "Zik Vault", promise: "Your documents. Kept close.", status: "Early Access", displayPrice: "35p/month", available: false, destination: "/vault", detail: "Encrypted storage on this device. Subscription billing is not connected yet; no subscription is created in this build." },
    { name: "Zik VaultCloud", promise: "A little extra peace of mind.", status: "Coming Soon", displayPrice: "99p/month", available: false, destination: null, detail: "An optional encrypted backup subscription, managed through Apple on iPhone." },
    { name: "Zik ID", promise: "Share identity only when you choose.", status: "Coming Soon", displayPrice: "£1.99 one-off", available: false, destination: "/id", detail: "Identity checks and issuance are not available yet." },
    { name: "Zik Validate", promise: "Independent document verification.", status: "Coming Soon", displayPrice: "From £5.99 · Depends on the document", available: false, destination: "/validate", detail: "The fee depends on the document needing validation. Professional verification is not connected yet." },
    { name: "Zik Pass via Finance Check", promise: "Prefer not to visit a store?", status: "Coming Soon", displayPrice: "£3.99 one-off", available: false, destination: "/prove-with-finance-check", detail: "A separate future remote route. Stripe, Apple Pay and Google Pay are prototyped but not connected. No charge or real finance check in this preview." }
  ] as const;
}
