import { JerkMeatSite } from "@/components/jerkmeat-site";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AGE_SESSION_COOKIE, readAffiliateAgeSession } from "@/lib/server/affiliate-demo-session";

export const metadata = { title: "JerkMeat — The kitchen" };

export default async function AffiliateContinuePage() {
  const session = await readAffiliateAgeSession((await cookies()).get(AGE_SESSION_COOKIE)?.value);
  if (!session) redirect("/affiliate-demo");
  return <JerkMeatSite unlocked />;
}
