import { cookies } from "next/headers";
import { AffiliateDemoLanding } from "@/components/affiliate-demo-landing";
import { AGE_SESSION_COOKIE, readAffiliateAgeSession } from "@/lib/server/affiliate-demo-session";

export const metadata = { title: "JerkMeat — Only the food is spicy", description: "A food-only parody and Zik Pass affiliate demonstration." };

export default async function AffiliateDemoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await readAffiliateAgeSession((await cookies()).get(AGE_SESSION_COOKIE)?.value);
  const params = await searchParams;
  return <AffiliateDemoLanding verifiedUntil={session?.expiresAt ?? null} denied={params.verification === "denied"} />;
}
