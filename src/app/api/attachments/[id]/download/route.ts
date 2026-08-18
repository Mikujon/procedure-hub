import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProcedure } from "@/lib/permissions";
import { storage } from "@/lib/storage";

/** Redirects to a short-lived presigned GET URL — same visibility rule as opening the procedure itself. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { procedure: true },
  });
  if (!attachment || attachment.procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canView = await canViewProcedure({ id: userId, tenantId, globalRole }, attachment.procedureId);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!storage.isStorageConfigured()) {
    return NextResponse.json({ error: "Object storage non configurato" }, { status: 503 });
  }

  const url = await storage.getDownloadUrl(attachment.storageKey, attachment.fileName);
  return NextResponse.redirect(url);
}
