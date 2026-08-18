import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = (session.user as any).tenantId as string;

  const departments = await prisma.department.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { procedures: true } },
    },
  });

  return NextResponse.json({ departments });
}

const createSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).globalRole !== "ADMIN") {
    return NextResponse.json({ error: "Only tenant admins can create departments" }, { status: 403 });
  }

  const tenantId = (session.user as any).tenantId as string;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const department = await prisma.department.create({
    data: {
      tenantId,
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      description: parsed.data.description,
      icon: parsed.data.icon,
      color: parsed.data.color,
    },
  });

  return NextResponse.json({ department }, { status: 201 });
}
