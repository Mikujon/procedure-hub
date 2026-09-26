// GET  /api/kb/admin/users  — list all tenant users with their org assignments
// POST /api/kb/admin/users  — create a new user (password hashed with bcrypt)
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const users = await db.user.findMany({
    where: { tenantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      location: true,
      language: true,
      active: true,
      avatarColor: true,
      assignments: {
        include: {
          node: { select: { id: true, name: true, type: true } },
        },
        orderBy: { validFrom: "desc" },
      },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const body = await req.json().catch(() => ({}));
  const {
    name,
    email,
    password,
    role,
    title,
    location,
    language,
    avatarColor,
  } = body ?? {};

  if (!name || !email || !password)
    return NextResponse.json(
      { error: "name, email and password are required" },
      { status: 400 }
    );

  const emailTaken = await db.user.findUnique({
    where: { email: String(email) },
    select: { id: true },
  });
  if (emailTaken)
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = await db.user.create({
    data: {
      tenantId,
      name: String(name),
      email: String(email),
      passwordHash,
      role: role ?? "VIEWER",
      title: title ?? null,
      location: location ?? null,
      language: language ?? "it",
      avatarColor: avatarColor ?? "#c2410c",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      location: true,
      language: true,
      active: true,
      avatarColor: true,
      createdAt: true,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "CREATE",
      entityType: "USER",
      entityId: user.id,
      summary: `Created user ${user.email} (${user.role})`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
