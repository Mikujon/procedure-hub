import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTenantAdmin } from "@/lib/permissions";

/** List job roles for the tenant — any authenticated member can read (needed to render the "assigned to" picker on a procedure). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;
  const jobRoles = await prisma.jobRole.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ jobRoles });
}

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

/** Job roles are tenant-wide organizational taxonomy, same admin-only bar as user management. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  if (!isTenantAdmin({ id: userId, tenantId, globalRole })) {
    return NextResponse.json({ error: "Solo un amministratore può creare mansioni." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const jobRole = await prisma.jobRole.create({
      data: { tenantId, name: parsed.data.name, description: parsed.data.description },
    });
    return NextResponse.json({ jobRole }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: `Esiste già una mansione "${parsed.data.name}".` }, { status: 409 });
    }
    throw err;
  }
}
