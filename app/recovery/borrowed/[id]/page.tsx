import type { Metadata } from "next";
import { BorrowedPage } from "@/components/recovery/borrowed-page";

export const metadata: Metadata = {
  title: "Reply to a recovery conversation",
  description: "A restricted, time-boxed way to reply from a borrowed device."
};

export default async function RecoveryBorrowedPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  return <BorrowedPage conversationId={id} replyToken={token ?? ""} />;
}
