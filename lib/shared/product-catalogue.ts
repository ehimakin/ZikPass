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
      displayPrice: "Planned: £0.35/month standalone · Included in the £3.99 remote bundle",
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
      promise: "Get a document independently verified.",
      status: "Workflow prototype",
      displayPrice: "Demo · No payment",
      available: false,
      destination: "/validate",
      detail: "Upload the document you’ve been asked to validate. Zik helps determine what kind of verification is required and connects it with an appropriate verifier."
    },
    {
      name: "Zik Pass · Finance Check",
      promise: "A fully remote route to proving you’re 18+ online.",
      status: "Product 7 · Prototype",
      displayPrice: "Proposed: £3.99 one-off",
      available: false,
      destination: "/prove-with-finance-check",
      detail: "£3.99 includes the finance check, ZikVault and passport verification, with no shop visit. Adding a passport scan would start a disclosed remote verification step, with no separate check fee. Explore the sample journey. Provider integration, assurance testing and legal review are required before launch."
    }
  ] as const;
}
