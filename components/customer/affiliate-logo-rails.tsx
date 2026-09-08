"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { affiliateRows, desktopAffiliateCapacity, shuffleAffiliates } from "@/lib/shared/affiliate-layout";

// One shuffled pool per document load; client navigation and resize keep its order.
let poolRequest: Promise<string[]> | undefined;
function getPool() {
  return poolRequest ??= fetch("/api/affiliates/logos", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Affiliate logos unavailable");
      return shuffleAffiliates(await response.json() as string[]);
    })
    .catch(() => { poolRequest = undefined; return []; });
}

export function AffiliateLogoRails() {
  const [logos, setLogos] = useState<string[]>([]);
  const [capacity, setCapacity] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void getPool().then((pool) => { if (!cancelled) setLogos(pool); });
    const nav = root.current?.parentElement?.querySelector('nav[aria-label="Primary"]');
    const update = () => setCapacity(desktopAffiliateCapacity(window.innerHeight, nav?.getBoundingClientRect().height ?? 64));
    const observer = new ResizeObserver(update);
    if (nav) observer.observe(nav);
    window.addEventListener("resize", update);
    update();
    return () => { cancelled = true; observer.disconnect(); window.removeEventListener("resize", update); };
  }, []);

  const desktop = logos.slice(0, capacity);
  const midpoint = Math.ceil(desktop.length / 2);
  const renderRows = (group: string[]) => affiliateRows(group).map((row, index) => (
    <div key={index} className="zk-affiliate-row">
      {row.map((src) => (
        <div key={src} className="zk-affiliate-logo">
          <Image src={src} alt="" fill sizes="100px" className="scale-[0.847875] object-contain" />
        </div>
      ))}
    </div>
  ));

  return (
    <div ref={root} className="zk-affiliate-presentation" aria-hidden="true">
      <div className="zk-affiliate-mobile">
        {renderRows(logos.slice(0, Math.ceil(logos.length / 2)))}
      </div>
      <div className="zk-affiliate-rails">
        {[desktop.slice(0, midpoint), desktop.slice(midpoint)].map((group, side) => (
          <div key={side} className={`zk-affiliate-rail zk-affiliate-rail--${side === 0 ? "left" : "right"}`}>
            <div className="zk-affiliate-rows">{renderRows(group)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
