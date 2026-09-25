import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUserId } from "@/lib/session";
import type { ProcedureStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const TRANSITIONS: Record<string, { to: ProcedureStatus; action: string; summary: string }[]> = {
  DRAFT: [
    { to: "IN_REVIEW", action: "SUBMIT", summary: "Submitted for review" },
  ],
  IN_REVIEW: [
    { to: "PUBLISHED", action: "PUBLISH", summary: "Approved and published" },
    { to: "DRAFT", action: "REJECT", summary: "Returned to draft" },
  ],
  PUBLISHED: [
    { to: "ARCHIVED", action: "ARCHIVE", summary: "Archived" },
  ],
  ARCHIVED: [],
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const body = await req.json().catch(() => ({}));
  const target = body.target as ProcedureStatus | undefined;

  const procedure = await db.procedure.findUnique({ where: { id } });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = TRANSITIONS[procedure.status] ?? [];
  const transition = allowed.find((t) => t.to === target);
  if (!transition)
    return NextResponse.json(
      { error: `Cannot transition from ${procedure.status} to ${target}` },
      { status: 400 }
    );

  const newVersion = target === "PUBLISHED" ? procedure.version + 1 : procedure.version;
  const publishedAt =
    target === "PUBLISHED" ? new Date() : procedure.publishedAt;

  const updated = await db.procedure.update({
    where: { id },
    data: { status: target, version: newVersion, publishedAt },
  });

  await db.auditLog.create({
    data: {
      action: transition.action,
      entityType: "PROCEDURE",
      entityId: id,
      summary: `${transition.summary}${newVersion !== procedure.version ? ` (v${newVersion})` : ""}`,
      userId,
      procedureId: id,
    },
  });

  return NextResponse.json({
    ok: true,
    status: updated.status,
    version: updated.version,
    publishedAt: updated.publishedAt,
  });
}
