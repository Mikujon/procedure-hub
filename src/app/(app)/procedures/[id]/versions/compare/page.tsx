import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewProcedure } from "@/lib/permissions";
import { computeVersionDiff, summarizeDiff } from "@/lib/diff";
import { VersionCompareControls } from "@/components/procedures/version-compare-controls";
import { VersionDiffView } from "@/components/procedures/version-diff-view";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CompareVersionsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id as string;
  const tenantId = (session!.user as any).tenantId as string;
  const globalRole = (session!.user as any).globalRole as string;

  const procedure = await prisma.procedure.findUnique({
    where: { id: params.id },
    include: {
      department: true,
      versions: { orderBy: { versionNumber: "desc" }, include: { author: { select: { name: true } } } },
    },
  });
  if (!procedure || procedure.tenantId !== tenantId) notFound();

  const canView = await canViewProcedure({ id: userId, tenantId, globalRole: globalRole as any }, procedure.id);
  if (!canView) notFound();

  const versions = procedure.versions;
  if (versions.length < 2) redirect(`/procedures/${procedure.id}`);

  const toVersion = versions.find((v) => String(v.versionNumber) === searchParams.to) ?? versions[0];
  const fromVersion =
    versions.find((v) => String(v.versionNumber) === searchParams.from) ??
    // versions is already ordered newest-first, so the first match here is
    // the version immediately preceding toVersion, not just any older one.
    versions.find((v) => v.versionNumber < toVersion.versionNumber) ??
    versions[versions.length - 1];

  const diff = computeVersionDiff(fromVersion.contentJson, toVersion.contentJson);
  const summary = summarizeDiff(diff);
  const sameVersion = fromVersion.versionNumber === toVersion.versionNumber;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/procedures/${procedure.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {procedure.title}
      </Link>

      <div className="opacity-0 animate-rise">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Confronto versioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {procedure.code} · {procedure.department.name}
        </p>
      </div>

      <div className="mt-4 opacity-0 animate-rise" style={{ animationDelay: "60ms" }}>
        <VersionCompareControls
          procedureId={procedure.id}
          versions={versions.map((v) => ({
            versionNumber: v.versionNumber,
            createdAt: v.createdAt.toISOString(),
            authorName: v.author.name,
          }))}
          fromVersion={fromVersion.versionNumber}
          toVersion={toVersion.versionNumber}
        />
      </div>

      {sameVersion ? (
        <p className="my-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 opacity-0 animate-rise dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Seleziona due versioni diverse per vedere le differenze.
        </p>
      ) : (
        <div className="my-4 flex flex-wrap items-center gap-2 text-xs opacity-0 animate-rise" style={{ animationDelay: "120ms" }}>
          <Badge variant="secondary">
            <span className="text-emerald-600 dark:text-emerald-400">+{summary.added}</span>&nbsp;aggiunti
          </Badge>
          <Badge variant="secondary">
            <span className="text-rose-600 dark:text-rose-400">−{summary.removed}</span>&nbsp;rimossi
          </Badge>
          <Badge variant="secondary">
            <span className="text-amber-600 dark:text-amber-400">~{summary.modified}</span>&nbsp;modificati
          </Badge>
        </div>
      )}

      <div className="opacity-0 animate-rise" style={{ animationDelay: "180ms" }}>
        <Card>
          <CardContent className="px-4 py-2">{sameVersion ? null : <VersionDiffView blocks={diff} />}</CardContent>
        </Card>
      </div>
    </div>
  );
}
