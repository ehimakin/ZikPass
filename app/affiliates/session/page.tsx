import { redirect } from "next/navigation";
import type { Route } from "next";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  redirect(`/dashboard/affiliate/session${query.size ? `?${query}` : ""}` as Route);
}
