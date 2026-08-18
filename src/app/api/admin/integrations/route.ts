import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).globalRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = (session.user as any).tenantId as string;
  const integrations = await prisma.integration.findMany({ where: { tenantId } });

  // Never leak secrets to the client — strip anything that looks like a token/key/secret.
  const sanitized = integrations.map((i) => ({
    ...i,
    config: Object.fromEntries(
      Object.entries(i.config as Record<string, any>).map(([k, v]) => [
        k,
        /token|secret|key|password/i.test(k) ? "••••••••" : v,
      ])
    ),
  }));

  return NextResponse.json({ integrations: sanitized });
}

const upsertSchema = z.object({
  type: z.enum(["SLACK", "GOOGLE_CHAT", "MICROSOFT_TEAMS", "ENTRA_ID", "SHAREPOINT", "JIRA", "SERVICENOW", "FRESHDESK"]),
  isEnabled: z.boolean(),
  config: z.record(z.any()),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).globalRole !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tenantId = (session.user as any).tenantId as string;
  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const integration = await prisma.integration.upsert({
    where: { tenantId_type: { tenantId, type: parsed.data.type } },
    update: { isEnabled: parsed.data.isEnabled, config: parsed.data.config },
    create: {
      tenantId,
      type: parsed.data.type,
      isEnabled: parsed.data.isEnabled,
      config: parsed.data.config,
    },
  });

  return NextResponse.json({ integration });
}
