import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusStamp } from "@/components/procedures/status-stamp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function DepartmentPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const tenantId = (session!.user as any).tenantId as string;

  const department = await prisma.department.findUnique({
    where: { tenantId_slug: { tenantId, slug: params.slug } },
    include: {
      processes: { orderBy: { sortOrder: "asc" }, include: { children: true } },
    },
  });
  if (!department) notFound();

  const procedures = await prisma.procedure.findMany({
    where: { tenantId, departmentId: department.id, parentId: null },
    orderBy: { updatedAt: "desc" },
    include: { tags: { include: { tag: true } }, process: true },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dipartimento</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{department.name}</h1>
          {department.description && <p className="mt-1 text-muted-foreground">{department.description}</p>}
        </div>
        <Button asChild>
          <Link href={`/procedures/new?department=${department.id}`}>
            <Plus className="h-4 w-4" /> Nuova procedura
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">Codice</th>
              <th className="px-4 py-3 font-medium">Titolo</th>
              <th className="px-4 py-3 font-medium">Processo</th>
              <th className="px-4 py-3 font-medium">Tag</th>
              <th className="px-4 py-3 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody>
            {procedures.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted">
                <td className="px-4 py-3">
                  <Link href={`/procedures/${p.id}`} className="font-mono text-xs text-primary hover:underline">
                    {p.code}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/procedures/${p.id}`} className="font-medium hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.process?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <Badge key={t.tagId} variant="secondary">
                        {t.tag.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusStamp status={p.status} />
                </td>
              </tr>
            ))}
            {procedures.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nessuna procedura in questo dipartimento. Creane una per iniziare.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
