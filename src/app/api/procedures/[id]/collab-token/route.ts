import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure, canViewProcedure } from "@/lib/permissions";

/**
 * Mints a short-lived JWT the client hands to collab-server (a separate
 * Node process, outside the Next.js session/cookie flow) to open the
 * Hocuspocus WebSocket connection for this procedure. collab-server
 * re-verifies this token itself (see collab-server/index.ts) rather than
 * trusting the client — never skip that check there.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const canView = await canViewProcedure({ id: userId, tenantId, globalRole }, params.id);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const procedure = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canEdit = await canEditProcedure({ id: userId, tenantId, globalRole }, procedure.departmentId);

  const secret = process.env.COLLAB_JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Collaboration is not configured (COLLAB_JWT_SECRET missing)" }, { status: 500 });
  }

  const token = jwt.sign(
    { userId, tenantId, procedureId: params.id, canEdit },
    secret,
    { expiresIn: "2h" }
  );

  return NextResponse.json({ token, canEdit });
}
