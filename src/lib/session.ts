import { getServerSession } from "next-auth";
import { authOptions, type AppSession } from "@/lib/auth";

/**
 * Server-side: returns the current tenant context from the NextAuth session.
 * Every API route that touches tenant data must call this and scope its
 * Prisma queries by tenantId. Unauthenticated requests get a 401.
 */
export async function getTenantContext(): Promise<{
  userId: string;
  tenantId: string;
  role: string;
} | null> {
  const session = (await getServerSession(authOptions)) as AppSession | null;
  if (!session?.user?.tenantId) return null;
  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role,
  };
}

/**
 * Require a session. Returns the context or throws a 401-shaped error.
 * Usage in route handlers:
 *   const ctx = await requireTenant();
 *   if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function requireTenant() {
  return getTenantContext();
}
