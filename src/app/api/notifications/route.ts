import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import { toNotificationDTO } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json(notifications.map(toNotificationDTO));
}
