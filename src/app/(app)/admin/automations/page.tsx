import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { AutomationsPanel } from "@/components/settings/automations-panel";

export default async function AutomationsPage() {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;
  const globalRole = (session!.user as any).globalRole as string;
  if (globalRole !== "ADMIN") redirect("/dashboard");

  const rules = await prisma.automationRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } }, _count: { select: { runs: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Automazioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regole che notificano o archiviano procedure automaticamente, senza intervento manuale.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-border py-4">
          <Zap className="h-4 w-4 text-primary" />
          <CardTitle className="font-display text-sm font-semibold uppercase tracking-wide">Regole</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AutomationsPanel rules={rules as any} />
        </CardContent>
      </Card>
    </div>
  );
}
