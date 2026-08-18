import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditWorkspace } from "@/lib/permissions";

const schema = z.object({ ownerId: z.string().nullable() });

/**
 * Sets/clears the intermediate "pagina governata" level: an owner without
 * a full approval workflow — no Procedure row created, just Page.ownerId.
 * Not available once a page is a full Documento Controllato (Fase 3):
 * ownership there is Procedure.ownerId, set through the procedure's own edit path.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!(await canEditWorkspace({ id: userId, tenantId, globalRole }))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const page = await prisma.page.findFirst({ where: { id: params.id, tenantId }, include: { procedure: { select: { id: true } } } });
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (page.procedure) {
    return NextResponse.json({ error: "Documento Controllato: imposta l'owner dalla pagina della procedura." }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.ownerId) {
    const owner = await prisma.user.findFirst({ where: { id: parsed.data.ownerId, tenantId }, select: { id: true } });
    if (!owner) return NextResponse.json({ error: "Owner not found" }, { status: 404 });
  }

  const updated = await prisma.page.update({
    where: { id: params.id },
    data: { ownerId: parsed.data.ownerId },
    select: { id: true, ownerId: true },
  });

  return NextResponse.json({ page: updated });
}
