import Image from "next/image";
import brands from "@/public/affiliates/logos/manifest.json";

const arrangedBrands = [14, 3, 13, 7, 11, 0, 1, 5, 16, 9, 4, 2, 19, 6, 15, 20, 21, 10, 12, 17, 8, 18].map(
  (index) => brands[index],
);

/** Decorative fictional affiliates: two fixed groups of 3 / 4 / 4. */
export function AffiliateLogoRails() {
  return (
    <div className="zk-affiliate-rails" aria-hidden="true">
      {[arrangedBrands.slice(0, 11), arrangedBrands.slice(11, 22)].map((group, side) => (
        <div key={side} className={`zk-affiliate-rail zk-affiliate-rail--${side === 0 ? "left" : "right"}`}>
          <div className="zk-affiliate-rows">
            {[group.slice(0, 3), group.slice(3, 7), group.slice(7, 11)].map((row, index) => (
              <div key={index} className="zk-affiliate-row">
                {row.map((brand) => (
                  <div key={brand.slug} className="zk-affiliate-logo">
                    <Image
                      src={`/affiliates/logos/desktop/${brand.slug}.svg`}
                      alt=""
                      fill
                      sizes="100px"
                      className="scale-[0.847875] object-contain"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
