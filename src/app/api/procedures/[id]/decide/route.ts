import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decideWorkflowStep } from "@/lib/workflow";
import { canActOnComplianceStage, canPublishProcedure } from "@/lib/permissions";

const schema = z.object({
  stepId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Tenant-scoped on purpose, before anything else: without this, a step
  // belonging to another tenant's procedure would still resolve, and an
  // ADMIN/COMPLIANCE_OFFICER of *this* tenant could decide on it — the
  // role checks below have no tenant awareness of their own to catch that.
  const procedure = await prisma.procedure.findUnique({ where: { id: params.id } });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const step = await prisma.workflowStep.findUnique({ where: { id: parsed.data.stepId } });
  if (!step || step.procedureId !== params.id) {
    return NextResponse.json({ error: "Workflow step not found" }, { status: 404 });
  }

  const actor = { id: userId, tenantId, globalRole };

  const authorized =
    step.stage === "COMPLIANCE_APPROVAL"
      ? canActOnComplianceStage(actor)
      : await canPublishProcedure(actor, procedure.departmentId);

  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await decideWorkflowStep(parsed.data.stepId, userId, parsed.data.decision, parsed.data.comment);
  return NextResponse.json({ status: result });
}
