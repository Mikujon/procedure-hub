import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DepartmentTree } from "@/components/layout/department-tree";
import { Plus } from "lucide-react";

export default async function DepartmentPage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id as string;
  const tenantId = (session!.user as any).tenantId as string;
  const globalRole = (session!.user as any).globalRole as string;

  const department = await prisma.department.findUnique({
    where: { tenantId_slug: { tenantId, slug: params.slug } },
    select: { id: true, name: true, description: true },
  });
  if (!department) notFound();

  const canEdit = await canEditProcedure({ id: userId, tenantId, globalRole: globalRole as any }, department.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between opacity-0 animate-rise">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dipartimento</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{department.name}</h1>
          {department.description && <p className="mt-1 text-muted-foreground">{department.description}</p>}
        </div>
        {canEdit && (
          <Button asChild>
            <Link href={`/procedures/new?department=${department.id}`}>
              <Plus className="h-4 w-4" /> Nuova procedura
            </Link>
          </Button>
        )}
      </div>

      {/* Stesso componente della sidebar (DepartmentTree) — qui a pieno formato:
          righe più dense (pallino di stato + codice), primo livello già aperto. */}
      <Card className="overflow-hidden p-2 opacity-0 animate-rise" style={{ animationDelay: "60ms" }}>
        <DepartmentTree departmentId={department.id} variant="page" />
      </Card>
    </div>
  );
}
