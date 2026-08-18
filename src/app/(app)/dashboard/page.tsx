import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProcedureListRow } from "@/components/dashboard/procedure-list-row";
import { Megaphone, Clock, Star, Briefcase } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id as string;
  const tenantId = (session!.user as any).tenantId as string;

  // Session/JWT doesn't carry jobRoleId (Fase 3a, informative-only field,
  // not worth threading through the auth callback) — read it directly.
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { jobRole: { select: { id: true, name: true } } },
  });

  const [recent, favorites, announcements, dueForReview, forMyRole] = await Promise.all([
    prisma.procedure.findMany({
      where: { tenantId, status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { department: true },
    }),
    prisma.favorite.findMany({
      where: { userId },
      take: 6,
      include: { procedure: { include: { department: true } } },
    }),
    prisma.announcement.findMany({
      where: { tenantId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 3,
    }),
    prisma.procedure.findMany({
      where: {
        tenantId,
        status: "PUBLISHED",
        nextReviewDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
      take: 5,
      orderBy: { nextReviewDate: "asc" },
      include: { department: true },
    }),
    currentUser?.jobRole
      ? prisma.procedure.findMany({
          where: { tenantId, status: "PUBLISHED", jobRoles: { some: { jobRoleId: currentUser.jobRole.id } } },
          take: 6,
          orderBy: { updatedAt: "desc" },
          include: { department: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Buongiorno, {session!.user!.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Ecco cosa è successo nella documentazione aziendale.
        </p>
      </div>

      {announcements.length > 0 && (
        <div className="space-y-2">
          {announcements.map((a) => (
            <Alert key={a.id} variant="primary">
              <Megaphone />
              <AlertTitle>{a.title}</AlertTitle>
              <AlertDescription>{a.body}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="text-lg">Aggiornate di recente</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {recent.map((p) => (
              <ProcedureListRow
                key={p.id}
                id={p.id}
                title={p.title}
                code={p.code}
                departmentName={p.department.name}
                date={p.updatedAt}
                status={p.status}
              />
            ))}
            {recent.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nessuna procedura pubblicata ancora.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card>
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-4 w-4" /> Preferiti
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {favorites.map((f) => (
                <ProcedureListRow
                  key={f.id}
                  id={f.procedure.id}
                  title={f.procedure.title}
                  meta={f.procedure.department.name}
                />
              ))}
              {favorites.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nessun preferito.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border py-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4" /> In scadenza
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border p-0">
              {dueForReview.map((p) => (
                <ProcedureListRow
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  meta={`Revisione entro ${p.nextReviewDate ? formatDate(p.nextReviewDate) : "—"}`}
                />
              ))}
              {dueForReview.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nessuna scadenza imminente.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {forMyRole !== null && (
        <Card>
          <CardHeader className="border-b border-border py-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-4 w-4" /> Procedure per il tuo ruolo
              <span className="text-sm font-normal text-muted-foreground">— {currentUser!.jobRole!.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {forMyRole.map((p) => (
              <ProcedureListRow
                key={p.id}
                id={p.id}
                title={p.title}
                code={p.code}
                departmentName={p.department.name}
                date={p.updatedAt}
                status={p.status}
              />
            ))}
            {forMyRole.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nessuna procedura assegnata alla tua mansione ancora.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
