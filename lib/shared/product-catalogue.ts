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
      promise: "Your documents, kept and read on your own device.",
      status: "Working on this device",
      displayPrice: "Planned: £0.99/month",
      available: false,
      destination: "/vault",
      detail: "What I can prove. Documents you choose are stored encrypted on this device and can be read here to suggest details you review. Nothing is uploaded, and nothing Zik reads is a check that a document is genuine."
    },
    {
      name: "Zik ID",
      promise: "An identity application built from details you have confirmed in your Vault.",
      status: "Application only",
      displayPrice: "Planned: £2.99 one-off",
      available: false,
      destination: null,
      detail: "Who I am when identity is genuinely required. You can prepare and save an application today. The identity checks behind a Zik ID are not available yet, so none can be issued."
    }
  ] as const;
}
