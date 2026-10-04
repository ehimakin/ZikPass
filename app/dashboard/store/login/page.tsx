import { StoreLogin } from "@/components/operator/store-login";
import { storeDestination } from "@/lib/shared/dashboard";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
  return <StoreLogin nextPath={storeDestination(value(params.next), value(params.code))} />;
}
