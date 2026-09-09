"use client";

import { useEffect, useState } from "react";
import type { SignedCredential } from "@/lib/shared/types";
import { buildCredentialZignatureSeedInput } from "@/lib/shared/zignature";
import { Zignature } from "@/components/zignature";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** The same saved pass presentation on Home and My Pass. */
export function SilverPassCard({ credential }: { credential: SignedCredential }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const active = new Date(credential.payload.activates_at).getTime() <= now && new Date(credential.payload.expires_at).getTime() > now;
  const expired = new Date(credential.payload.expires_at).getTime() <= now;
  const seed = buildCredentialZignatureSeedInput({
    credentialId: credential.payload.credential_id,
    subjectPublicKey: credential.payload.subject_public_key
  });
  return (
<div className="zk-home-pass-card-wrap mx-auto">
        <div className="zk-silver-pass-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold uppercase tracking-[0.16em] text-[#28623c]">
                Zik <span className="text-[#252525]">Pass</span>
              </p>
              <p className="mt-[1.5cqw] text-[7cqw] font-extrabold leading-none">18+ verified</p>
            </div>
            <span className="rounded-full bg-black/5 px-[2.5cqw] py-[1cqw] font-semibold">
              {expired ? "Expired" : active ? "Active" : "Activating"}
            </span>
          </div>

          <div className="rounded-[3cqw] border border-black/10 bg-white/25 px-[3cqw] py-[2cqw]">
            <Zignature
              animate={active}
              className="h-[13cqw] w-full"
              seedInput={seed}
              stroke="#28623c"
              strokeWidth={3}
              variant="full"
              width={320}
              height={72}
            />
          </div>

          <dl className="grid grid-cols-2 gap-x-[4cqw] border-t border-black/10 pt-[3cqw]">
            <div className="min-w-0">
              <dt className="text-[#626262]">Pass ID</dt>
              <dd className="mt-0.5 truncate font-mono" title={credential.payload.credential_id}>
                {credential.payload.credential_id}
              </dd>
            </div>
            <div>
              <dt className="text-[#626262]">Valid until</dt>
              <dd className="mt-0.5 font-semibold">{formatDate(credential.payload.expires_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
  );
}
