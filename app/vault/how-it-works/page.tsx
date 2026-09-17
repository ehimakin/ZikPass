import type { Metadata } from "next";
import { CustomerShell } from "@/components/customer/customer-shell";
import { ButtonLink } from "@/components/customer/ui";
import styles from "./vault-guide.module.css";

export const metadata: Metadata = {
  title: "How Zik Vault works",
  description: "Explore the idea behind Zik Vault: a private place for your documents and control over what you share."
};

export default function VaultGuidePage() {
  return <CustomerShell active="pass" immersive>
    <article className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow} data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-1" : undefined}>HOW ZIK VAULT WORKS</p>
        <h1 data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-2" : undefined}>Your documents.<br /><em>Your say.</em></h1>
        <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-3" : undefined}>A home for the things that prove something about you. The vision for Vault is simple: keep your documents on your device and choose what you share.</p>
        <div className={styles.actions}><ButtonLink href="/vault">Explore Vault</ButtonLink><ButtonLink href="/home" variant="ghost">Back to Zik</ButtonLink></div>
      </header>
      <section className={styles.preview} aria-labelledby="preview-title">
        <h2 id="preview-title" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-4" : undefined}>Try the idea today.</h2>
        <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-5" : undefined}>Vault is currently a demo with fictional documents. Real document storage, AI search, identity verification and sharing are not available yet.</p>
        {process.env.NODE_ENV === "development" && <p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-6" : undefined}>Use <strong>memaguy</strong> on the Vault page to explore. Your samples disappear when you lock the demo or refresh.</p>}
      </section>
      <section aria-labelledby="vision-title">
        <h2 id="vision-title" className={styles.sectionTitle} data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-7" : undefined}>The Vault we’re building</h2>
        <ol className={styles.steps}>
          <li><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-8" : undefined}>01</span><div><h3 data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-9" : undefined}>Bring your documents together.</h3><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-10" : undefined}>Start with a blank Vault. Add ID, address proof, qualifications, certificates, contracts, receipts or other documents you want to keep organised.</p></div></li>
          <li><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-11" : undefined}>02</span><div><h3 data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-12" : undefined}>Find only what you choose.</h3><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-13" : undefined}>The planned on-device AI search would look for your selected document types in photos and files you explicitly permit. Review possible matches before adding anything.</p></div></li>
          <li><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-14" : undefined}>03</span><div><h3 data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-15" : undefined}>Keep storage and verification separate.</h3><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-16" : undefined}>Saving a document does not make it verified. We’re exploring an optional in-person check, where a trained clerk compares you and your original ID before approved facts can become reusable proofs.</p></div></li>
          <li><span aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-17" : undefined}>04</span><div><h3 data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-18" : undefined}>Share a fact, with your permission.</h3><p data-local-edit={process.env.NODE_ENV === "development" ? "ve-c9e4451dcebc-19" : undefined}>The aim is to let you approve a specific proof, such as being over 18, without routinely handing over the entire document. Any external verification checks would need a clear explanation of the information involved.</p></div></li>
        </ol>
      </section>
      <footer className={styles.actions}><ButtonLink href="/vault">Go to Vault</ButtonLink></footer>
    </article>
  </CustomerShell>;
}
