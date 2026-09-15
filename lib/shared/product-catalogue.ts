/** Display copy only. Pass pricing is supplied by the server's getPassPrice().
 * Planned products have no payment, entitlement or persistence integration. */
export function getProductCatalogue(passDisplayPrice: string) {
  return [
    {
      name: "Zik Pass",
      promise: "Prove you’re 18+ online without sharing your identity.",
      status: "Available now",
      displayPrice: `${passDisplayPrice} one-off`,
      available: true,
      destination: "/find",
      detail: "One thing about me that I can prove without identifying myself. No subscription or ZikVault required."
    },
    {
      name: "ZikVault",
      promise: "A device-held pool of things you can prove about yourself.",
      status: "Coming next",
      displayPrice: "Planned: £0.99/month",
      available: false,
      destination: null,
      detail: "What I can prove. Verified credentials designed to live on your device, ready to share only the claims a situation requires."
    },
    {
      name: "Zik ID",
      promise: "A ready-made identity assembled from verified information in ZikVault.",
      status: "Planned",
      displayPrice: "Planned: £2.99 one-off",
      available: false,
      destination: null,
      detail: "Who I am when identity is genuinely required. A predefined presentation of Vault claims, not a separate identity store."
    }
  ] as const;
}
