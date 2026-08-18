import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Building2, Users, FolderTree, Plug, ShieldCheck, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Amministratore",
  COMPLIANCE_OFFICER: "Compliance Officer",
  USER: "Utente",
};

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;
  const globalRole = (session!.user as any).globalRole as string;
  if (globalRole !== "ADMIN") redirect("/dashboard");

  const [tenant, users, departments, integrations] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.user.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.department.count({ where: { tenantId } }),
    prisma.integration.findMany({ where: { tenantId } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Impostazioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configurazione del tenant, team e integrazioni.</p>
      </div>

      {/* Tenant profile */}
      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Organizzazione</h2>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
            <Field label="Nome" value={tenant?.name} />
            <Field label="Slug" value={tenant?.slug} mono />
            <Field label="Piano" value={tenant?.plan} />
            <Field label="Utenti max" value={String(tenant?.maxUsers ?? "—")} />
          </dl>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatLink icon={Users} label="Membri del team" value={users.length} href="#team" />
        <StatLink icon={FolderTree} label="Dipartimenti" value={departments} href="/dashboard" />
        <StatLink icon={Plug} label="Integrazioni attive" value={integrations.filter((i) => i.isEnabled).length} href="/admin" />
      </div>

      {/* Team */}
      <Card id="team">
        <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-border py-4">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Team</h2>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {u.name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Badge variant="secondary" className="rounded-full">
                      {u.globalRole === "ADMIN" && <ShieldCheck className="h-3 w-3" />}
                      {ROLE_LABEL[u.globalRole] ?? u.globalRole}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className={`text-xs ${u.isActive ? "text-[hsl(var(--stamp-green))]" : "text-muted-foreground"}`}>
                      {u.isActive ? "Attivo" : "Disattivato"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Integrations link */}
      <Link
        href="/admin"
        className="flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 shadow-sm hover:bg-muted"
      >
        <div className="flex items-center gap-3">
          <Plug className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">Integrazioni & notifiche</p>
            <p className="text-sm text-muted-foreground">Slack, Google Chat, e canali di notifica.</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Link>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value ?? "—"}</dd>
    </div>
  );
}

function StatLink({ icon: Icon, label, value, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted">
      <Icon className="mb-2 h-5 w-5 text-primary" />
      <p className="font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  );
}
