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
      displayPrice: "Planned: £0.35/month",
      available: false,
      destination: "/vault",
      detail: "What I can prove. Documents you choose are stored encrypted on this device and can be read here to suggest details you review. Uploads happen only if you choose an encrypted recovery backup. Nothing Zik reads is a check that a document is genuine."
    },
    {
      name: "ZikVault Cloud Backup",
      promise: "An optional encrypted copy of your Vault, held off this device.",
      status: "Not yet available",
      displayPrice: "Planned: £0.99/month, on top of ZikVault",
      available: false,
      destination: null,
      detail: "Files are encrypted on this device before anything leaves it. Zik stores the encrypted copy without the key needed to read it. Requires ZikVault."
    },
    {
      name: "Zik ID",
      promise: "An identity application built from details you have confirmed in your Vault.",
      status: "Application only",
      displayPrice: "Planned: £2.99 one-off",
      available: false,
      destination: null,
      detail: "Who I am when identity is genuinely required. You can prepare and save an application today. The identity checks behind a Zik ID are not available yet, so none can be issued."
    },
    {
      name: "Zik Validate",
      promise: "A trusted professional to vouch for your application.",
      status: "Product 6 · Planned",
      displayPrice: "Proposed: £9.99 one-time fee per validation",
      available: false,
      destination: "/customer_validate",
      detail: "Premium support for passport photo countersigning and ID applications, starting with people who already know a participating dentist or other reputable professional. A future peer-to-peer network could let dentists, doctors and other eligible professionals offer validations, with in-person appointments also being explored."
    }
  ] as const;
}
