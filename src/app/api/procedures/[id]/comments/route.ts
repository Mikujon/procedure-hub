import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProcedure } from "@/lib/permissions";
import { notifyEvent } from "@/lib/integrations/notify";
import { runCommentAddedAutomations } from "@/lib/automations/engine";

const createSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  parentId: z.string().optional(),
  /** User ids picked from the @mention autocomplete (2.6) — not parsed out of `body`, the client already knows exactly who was selected. */
  mentionedUserIds: z.array(z.string()).optional(),
});

/**
 * Comments are a lightweight participation action, not a governance one —
 * same tier as favorites/acknowledgments (no AuditLog row), not a workflow
 * or content mutation (which do write one). Anyone who can view the
 * procedure can comment on it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const procedure = await prisma.procedure.findFirst({ where: { id: params.id, tenantId }, select: { id: true } });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await canViewProcedure({ id: userId, tenantId, globalRole }, procedure.id);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { body, parentId, mentionedUserIds } = parsed.data;

  if (parentId) {
    // Replies attach only to a top-level comment on this procedure — keeps
    // the thread two levels deep (comment + flat replies) instead of an
    // arbitrarily nested tree the UI would then have to render.
    const parent = await prisma.comment.findFirst({ where: { id: parentId, procedureId: procedure.id, parentId: null } });
    if (!parent) return NextResponse.json({ error: "Commento a cui rispondere non valido" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { procedureId: procedure.id, authorId: userId, body, parentId: parentId ?? null },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  // COMMENT_ADDED automations (3.4) — same "await inline, never throws to
  // the caller" convention as runStatusAutomations/runAckCompletionAutomations
  // (fireRule swallows its own execution errors into AutomationRun.error).
  // fireKey = the comment's own id (3.5) — stable and unique per comment.
  await runCommentAddedAutomations(tenantId, procedure.id, comment.id);

  if (mentionedUserIds?.length) {
    // Re-validate server-side — the client's picker only offers tenant
    // members, but never trust ids coming back in the request body as-is.
    // Self-mentions are silently dropped rather than notified.
    const validMentions = await prisma.user.findMany({
      where: { id: { in: mentionedUserIds }, tenantId, isActive: true, NOT: { id: userId } },
      select: { id: true },
    });
    if (validMentions.length > 0) {
      await notifyEvent({
        tenantId,
        type: "MENTION",
        procedureId: procedure.id,
        userIds: validMentions.map((u) => u.id),
        title: `${comment.author.name} ti ha menzionato in un commento`,
        body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
        linkSuffix: "#commenti",
      });
    }
  }

  return NextResponse.json({ comment });
}
