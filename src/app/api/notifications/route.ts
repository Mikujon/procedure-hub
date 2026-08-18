import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;

  const notifications = await prisma.notification.findMany({
    where: { userId, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, channel: "IN_APP", readAt: null },
  });

  return NextResponse.json({ notifications, unreadCount });
}

/** Marks one or all notifications as read. Body: { id?: string } — omit id to mark all. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const { id } = await req.json().catch(() => ({ id: undefined }));

  await prisma.notification.updateMany({
    where: { userId, id: id ?? undefined, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
