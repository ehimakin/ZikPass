import type { NotificationRecord } from "@/lib/shared/types";
import { randomId } from "@/lib/shared/utils";

export function buildNotification(message: string): NotificationRecord {
  return {
    id: randomId("notif"),
    channel: "in_app",
    message,
    created_at: new Date().toISOString()
  };
}
