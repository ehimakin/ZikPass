import { StoreLogin } from "@/components/operator/store-login";

export const metadata = {
  title: "Store login · Zik Pass",
  description: "Select a store and sign in to the Zik Pass clerk tools."
};

export default async function StorePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = getParam(params.next);
  const customerCode = getParam(params.code);
  const nextPath = requested === "/verify/purchase"
    ? requested
    : customerCode
      ? `/verify?code=${encodeURIComponent(customerCode)}`
      : "/verify";
  return <StoreLogin nextPath={nextPath} />;
}

function getParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
