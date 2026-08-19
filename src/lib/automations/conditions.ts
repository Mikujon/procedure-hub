import { prisma } from "@/lib/prisma";
import type { AutomationConditions } from "./types";

/**
 * Same fixed guard shape resolveNextStage() (src/lib/workflow/index.ts)
 * already hardcodes for the compliance-tag skip, made admin-configurable.
 * Deliberately not a generic query builder — three fixed checks, all optional.
 */
export async function matchesConditions(
  procedure: { id: string; isCritical: boolean },
  conditions: AutomationConditions
): Promise<boolean> {
  if (!conditions) return true;

  if (conditions.isCriticalEquals !== undefined && procedure.isCritical !== conditions.isCriticalEquals) {
    return false;
  }

  if (conditions.tagNameIn?.length) {
    const hasTag = await prisma.procedureTag.findFirst({
      where: { procedureId: procedure.id, tag: { name: { in: conditions.tagNameIn } } },
    });
    if (!hasTag) return false;
  }

  if (conditions.tagNameNotIn?.length) {
    const hasExcludedTag = await prisma.procedureTag.findFirst({
      where: { procedureId: procedure.id, tag: { name: { in: conditions.tagNameNotIn } } },
    });
    if (hasExcludedTag) return false;
  }

  return true;
}
