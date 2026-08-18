import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

/**
 * Resolves the current Tenant row from the "x-tenant-slug" header set by
 * middleware.ts. Call this at the top of any server component, route
 * handler, or server action that touches tenant-scoped data — never trust
 * a tenantId passed in from the client directly.
 */
export async function getCurrentTenant() {
  const slug = headers().get("x-tenant-slug");
  if (!slug) return null;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  return tenant;
}

/** Same as getCurrentTenant but 404s if no tenant resolves. Use in pages. */
export async function requireTenant() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  return tenant;
}
