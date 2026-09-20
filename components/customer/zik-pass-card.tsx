import { ZikGlyph } from "@/components/zik-logo";

export function ZikPassCard({ digital = false }: { digital?: boolean }) {
  return <div className={`zk-physical-card${digital ? " zk-physical-card--digital" : ""}`} role="img" aria-label={digital ? "Zik Pass: digital pass, outlined card" : "Zik Card: lime physical backup card"}>
    <div className="zk-card-brand"><svg viewBox="0 0 100 100" aria-hidden="true"><ZikGlyph /></svg><span>{digital ? "Zik Pass" : "Zik Card"}</span></div>
    <span className="zk-card-watermark" aria-hidden="true">Zik</span>
    <div className="zk-card-footer"><span>{digital ? "Your digital pass." : "Your physical backup."}</span><span>{digital ? "DIGITAL ONLY" : "KEEP IT CLOSE"}</span></div>
  </div>;
}
