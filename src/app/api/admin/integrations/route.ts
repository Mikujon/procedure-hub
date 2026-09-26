import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeIntegrationConfig, mergeIntegrationConfig } from "@/lib/integrations/sanitize";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).globalRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = (session.user as any).tenantId as string;
  const integrations = await prisma.integration.findMany({ where: { tenantId } });

  // Never leak secrets to the client — strip anything that looks like a token/key/secret.
  const sanitized = integrations.map((i) => ({ ...i, config: sanitizeIntegrationConfig(i.config) }));

  return NextResponse.json({ integrations: sanitized });
}

const upsertSchema = z.object({
  type: z.enum(["SLACK", "GOOGLE_CHAT", "MICROSOFT_TEAMS", "ENTRA_ID", "SHAREPOINT", "JIRA", "SERVICENOW", "FRESHDESK"]),
  isEnabled: z.boolean(),
  config: z.record(z.any()),
});

/**
 * Upsert with a merge, not a wholesale replace of `config` — the
 * /admin/integrations form pre-fills secret fields with GET's masked
 * placeholder rather than the real value (which it never has), so a save
 * where the admin only touched, say, the URL must not wipe out an
 * already-stored token/secret it never saw. mergeIntegrationConfig treats
 * an incoming field equal to the mask placeholder as "leave whatever's
 * already there alone" — correct regardless of what a client sends, not
 * dependent on the client remembering to omit untouched fields.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).globalRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = (session.user as any).tenantId as string;
  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.integration.findUnique({
    where: { tenantId_type: { tenantId, type: parsed.data.type } },
  });
  const mergedConfig = mergeIntegrationConfig(existing?.config, parsed.data.config);

  const integration = await prisma.integration.upsert({
    where: { tenantId_type: { tenantId, type: parsed.data.type } },
    update: { isEnabled: parsed.data.isEnabled, config: mergedConfig },
    create: { tenantId, type: parsed.data.type, isEnabled: parsed.data.isEnabled, config: mergedConfig },
  });

  return NextResponse.json({ integration: { ...integration, config: sanitizeIntegrationConfig(integration.config) } });
}
