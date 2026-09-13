"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import type { SignedCredential } from "@/lib/shared/types";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import { Zignature } from "@/components/zignature";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A saved age credential presented as a verification seal, not a payment card. */
export function VerificationSeal({ credential, detailed = false, href }: { credential: SignedCredential; detailed?: boolean; href?: Route }) {
  const [now, setNow] = useState(() => Date.now());
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const active = new Date(credential.payload.activates_at).getTime() <= now && new Date(credential.payload.expires_at).getTime() > now;
  const expired = new Date(credential.payload.expires_at).getTime() <= now;
  const status = expired ? "Expired" : active ? "Active" : "Activating";
  const seed = buildCredentialZignatureSeedInput({
    credentialId: credential.payload.credential_id,
    subjectPublicKey: credential.payload.subject_public_key
  });

  const seal = (
      <section
        className={`zk-verification-seal ${href || detailed ? "zk-verification-seal--interactive" : ""}`}
        aria-label={`${href ? "Open My Pass. " : detailed ? `${detailsOpen ? "Hide" : "Show"} pass details. ` : ""}Zik Pass: 18 plus verified, ${status}`}
        aria-expanded={detailed ? detailsOpen : undefined}
        role={detailed ? "button" : undefined}
        tabIndex={detailed ? 0 : undefined}
        onClick={detailed ? () => setDetailsOpen((open) => !open) : undefined}
        onKeyDown={detailed ? (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setDetailsOpen((open) => !open);
        } : undefined}
      >
        <div className="zk-verification-seal-heading">
          <p><span>Zik</span> Pass</p>
          <span className="zk-verification-seal-status"><i />{status}</span>
        </div>

        <div className="zk-verification-seal-proof">
          <strong>18+</strong>
          <span>Age verified</span>
        </div>

        <div className="zk-verification-seal-signature" aria-hidden="true">
          <Zignature
            animate={active}
            className="h-full w-full"
            seedInput={seed}
            stroke="#28623c"
            strokeWidth={3}
            variant="full"
            width={320}
            height={72}
          />
        </div>

        <p className="zk-verification-seal-device">Verified on this device</p>
      </section>
  );

  return (
    <div className={`zk-verification-seal-wrap mx-auto ${detailed ? "zk-verification-seal-wrap--details" : href ? "zk-verification-seal-wrap--home-active" : ""}`}>
      {href ? <Link href={href} className="block rounded-full">{seal}</Link> : seal}

      {detailed ? (
        <div className={`zk-verification-seal-drawer ${detailsOpen ? "zk-verification-seal-drawer--open" : ""}`} aria-hidden={!detailsOpen}>
          <div className="zk-verification-seal-drawer-clip">
            <dl className="zk-verification-seal-details">
              <div>
                <dt>Pass ID</dt>
                <dd title={credential.payload.credential_id}>{credential.payload.credential_id}</dd>
              </div>
              <div>
                <dt>Valid until</dt>
                <dd>{formatDate(credential.payload.expires_at)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
