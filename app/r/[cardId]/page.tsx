import type { Metadata } from "next";
import { FinderPage } from "@/components/recovery/finder-page";

export const metadata: Metadata = {
  title: "Found this phone?",
  description: "Contact this phone's owner privately, with no account needed."
};

export default async function RecoveryFinderPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  return <FinderPage cardId={cardId} />;
}
