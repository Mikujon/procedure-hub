import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = ctx;
  const { id } = await params;
  await db.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
