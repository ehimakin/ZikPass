import { ZikGlyph } from "@/components/zik-logo";

export function ZikPassCard({ digital = false, pending = false }: { digital?: boolean; pending?: boolean }) {
  return <div className={`zk-physical-card${pending ? " zk-physical-card--pending" : digital ? " zk-physical-card--digital" : ""}`} role="img" aria-label={pending ? "Zik Card: demo purchase, awaiting receipt and activation" : digital ? "Zik Pass: digital pass, outlined card" : "Zik Card: lime physical backup card"}>
    <div className="zk-card-brand"><svg viewBox="0 0 100 100" aria-hidden="true"><ZikGlyph /></svg><span>{digital && !pending ? "Zik Pass" : "Zik Card"}</span></div>
    <span className="zk-card-watermark" aria-hidden="true" data-local-edit={process.env.NODE_ENV === "development" ? "ve-b121c6d5b0f4-1" : undefined}>Zik</span>
    <div className="zk-card-footer"><span>{pending ? "Awaiting receipt & activation." : digital ? "Your digital pass." : "Your physical backup."}</span><span>{pending ? "DEMO · NOT ACTIVE" : digital ? "DIGITAL ONLY" : "KEEP IT CLOSE"}</span></div>
  </div>;
}
