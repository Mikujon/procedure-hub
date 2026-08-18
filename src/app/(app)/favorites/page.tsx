import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { ProcedureListRow } from "@/components/dashboard/procedure-list-row";
import { Star } from "lucide-react";

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id as string;

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { procedure: { include: { department: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight">
          <Star className="h-6 w-6 text-stamp-amber" /> Preferiti
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Le procedure che hai salvato per accesso rapido.
        </p>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <Star className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nessun preferito. Apri una procedura e clicca la stella per salvarla qui.
          </p>
        </div>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {favorites.map((f) => (
            <ProcedureListRow
              key={f.id}
              id={f.procedure.id}
              title={f.procedure.title}
              code={f.procedure.code}
              departmentName={f.procedure.department.name}
              date={f.procedure.updatedAt}
              status={f.procedure.status}
            />
          ))}
        </Card>
      )}
    </div>
  );
}
