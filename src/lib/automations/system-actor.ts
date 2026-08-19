import { prisma } from "@/lib/prisma";

const SYSTEM_ACTOR_EMAIL = "system+automations@internal.procedurehub.local";

/**
 * Lazily creates/fetches the per-tenant synthetic actor that automation-fired
 * AuditLog rows attribute to — AuditLog.actorId is non-nullable, and an
 * automation rule acts without a human in the loop. isActive:false keeps it
 * out of notification audiences for free (resolveDefaultRecipients already
 * filters isActive:true); isSystem:true lets the admin user list exclude it.
 */
export async function getSystemActorId(tenantId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: SYSTEM_ACTOR_EMAIL } },
    select: { id: true },
  });
  if (existing) return existing.id;

  try {
    const created = await prisma.user.create({
      data: {
        tenantId,
        email: SYSTEM_ACTOR_EMAIL,
        name: "Automazioni",
        globalRole: "USER",
        isActive: false,
        isSystem: true,
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Lost a create race to a concurrent automation run for the same
    // tenant — the row exists now, just not the one we created.
    const raced = await prisma.user.findUniqueOrThrow({
      where: { tenantId_email: { tenantId, email: SYSTEM_ACTOR_EMAIL } },
      select: { id: true },
    });
    return raced.id;
  }
}
