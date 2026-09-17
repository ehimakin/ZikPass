import { getProductCatalogue } from "@/lib/shared/product-catalogue";
import { ButtonLink, Card, StatusBadge } from "@/components/customer/ui";

export function ProductFamily({ price }: { price: string }) {
  return (
    <ol className="space-y-3" aria-label="Zik product progression">
      {getProductCatalogue(price).map((product, index) => (
        <li key={product.name}>
          {index > 0 ? <p aria-hidden="true" className="mb-3 pl-6 text-xl text-[var(--zk-text-faint)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-292792b74590-1" : undefined}>↓</p> : null}
          <Card as="article" className={`p-5 ${product.available ? "border-[var(--zk-accent)] border-l-4" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-extrabold tracking-tight">{product.name}</h3>
              <StatusBadge tone={product.available ? "positive" : "neutral"}>{product.status}</StatusBadge>
            </div>
            <p className="mt-3 text-[15px] font-semibold leading-relaxed">{product.promise}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--zk-text-soft)]">{product.detail}</p>
            <p className="mt-4 text-sm font-bold">{product.displayPrice}</p>
            {product.available ? <ButtonLink href={product.destination} className="mt-4">Get Zik Pass · {price}</ButtonLink> : <p className="mt-2 text-xs text-[var(--zk-text-soft)]" data-local-edit={process.env.NODE_ENV === "development" ? "ve-292792b74590-2" : undefined}>Planned concept · Not available in this prototype</p>}
          </Card>
        </li>
      ))}
    </ol>
  );
}
