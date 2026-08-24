import { getServerSession } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditProcedure, canPublishProcedure, canActOnComplianceStage } from "@/lib/permissions";
import { StatusStamp } from "@/components/procedures/status-stamp";
import { WorkflowPanel } from "@/components/procedures/workflow-panel";
import { AcknowledgeButton } from "@/components/procedures/acknowledge-button";
import { AckDashboard } from "@/components/procedures/ack-dashboard";
import { FavoriteButton } from "@/components/procedures/favorite-button";
import { AttachmentsPanel } from "@/components/procedures/attachments-panel";
import { VersionHistory } from "@/components/procedures/version-history";
import { ExportMenu } from "@/components/procedures/export-menu";
import { CommentThread } from "@/components/procedures/comment-thread";
import { ProcedureBreadcrumb } from "@/components/procedures/procedure-breadcrumb";
import { ProcedureViewShell } from "@/components/procedures/procedure-view-shell";
import { PageOptionsMenu } from "@/components/procedures/page-options-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { stripHtml } from "@/lib/search";
import { renderContentWithToc } from "@/lib/toc";
import { injectEmbedIframes, injectDiagramPlaceholders } from "@/lib/embedded-blocks";
import { ReadingOutline } from "@/components/procedures/reading-outline";
import { MermaidRenderer } from "@/components/procedures/mermaid-renderer";
import { Pencil, History, MessageSquare, Lock } from "lucide-react";

export default async function ProcedurePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session!.user as any).id as string;
  const tenantId = (session!.user as any).tenantId as string;
  const globalRole = (session!.user as any).globalRole as string;

  const procedure = await prisma.procedure.findUnique({
    where: { id: params.id },
    include: {
      department: true,
      process: true,
      parent: { select: { id: true, code: true, processId: true, parentId: true } },
      currentVersion: true,
      versions: { orderBy: { versionNumber: "desc" }, include: { author: { select: { name: true } } } },
      tags: { include: { tag: true } },
      attachments: true,
      relatedFrom: { include: { to: { select: { id: true, title: true, code: true } } } },
      workflowSteps: { orderBy: { createdAt: "desc" }, take: 1 },
      author: { select: { name: true } },
      owner: { select: { name: true } },
      acknowledgments: { where: { userId } },
      favorites: { where: { userId }, select: { id: true } },
      comments: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          replies: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          },
        },
      },
    },
  });

  if (!procedure || procedure.tenantId !== tenantId) notFound();

  const actor = { id: userId, tenantId, globalRole: globalRole as any };
  const [canEdit, canPublish] = await Promise.all([
    canEditProcedure(actor, procedure.departmentId),
    canPublishProcedure(actor, procedure.departmentId),
  ]);
  const canDecideCompliance = canActOnComplianceStage(actor);

  const pendingStep = procedure.workflowSteps.find((s) => s.status === "PENDING");
  const canDecide = pendingStep
    ? pendingStep.stage === "COMPLIANCE_APPROVAL"
      ? canDecideCompliance
      : canPublish
    : false;

  // Not just "acknowledged at all" — a new PUBLISHED version reopens the
  // obligation (Fase 4), so an ack of an older version must not read as
  // "confirmed" for the current one. acknowledgments here is pre-filtered
  // to this user only (query below), so this only needs a version match.
  const alreadyAcknowledged = procedure.acknowledgments.some(
    (a) => a.versionNumber === procedure.currentVersion?.versionNumber
  );
  const canSeeAckDashboard =
    globalRole === "ADMIN" || globalRole === "COMPLIANCE_OFFICER" || procedure.ownerId === userId;

  const commentCount = procedure.comments.reduce((n, c) => n + 1 + c.replies.length, 0);
  // A pipeline over the rendered HTML: EMBED/DIAGRAM sentinels (see
  // lib/blocks/serialize.ts) become a real <iframe> and a placeholder
  // <pre> respectively (lib/embedded-blocks.ts — the diagram one needs
  // MermaidRenderer below to actually render, client-side), then
  // renderContentWithToc assigns heading anchor ids and splices any
  // TABLE_OF_CONTENTS block's sentinel into links to those same anchors.
  const withEmbeds = injectEmbedIframes(procedure.currentVersion?.contentHtml ?? "<p>Nessun contenuto ancora.</p>");
  const withDiagrams = injectDiagramPlaceholders(withEmbeds);
  const { html: renderedContentHtml, headings: tocHeadings } = renderContentWithToc(withDiagrams);
  const contentText = stripHtml(renderedContentHtml);

  return (
    <ProcedureViewShell>
      <MermaidRenderer />
      <ProcedureBreadcrumb
        departmentId={procedure.department.id}
        departmentSlug={procedure.department.slug}
        departmentName={procedure.department.name}
        processId={procedure.process?.id ?? null}
        processName={procedure.process?.name ?? null}
        parentProcedure={procedure.parent}
        procedureId={procedure.id}
        procedureCode={procedure.code}
        procedureProcessId={procedure.processId}
        procedureParentId={procedure.parentId}
      />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{procedure.title}</h1>
          {procedure.summary && <p className="mt-2 text-muted-foreground">{procedure.summary}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusStamp status={procedure.status} />
            {procedure.isLocked && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" /> Bloccata
              </Badge>
            )}
            {procedure.isCritical && <Badge variant="destructive">Critical Process</Badge>}
            {procedure.tags.map((t) => (
              <Badge key={t.tagId} variant="secondary">
                {t.tag.name}
              </Badge>
            ))}
            {commentCount > 0 && (
              <a href="#commenti" className="inline-flex">
                <Badge variant="secondary" className="gap-1">
                  <MessageSquare className="h-3 w-3" /> {commentCount}
                </Badge>
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <FavoriteButton procedureId={procedure.id} initialFavorited={procedure.favorites.length > 0} />
          {procedure.currentVersion && <ExportMenu procedureId={procedure.id} />}
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/procedures/${procedure.id}/edit`}>
                <Pencil className="h-4 w-4" /> Modifica
              </Link>
            </Button>
          )}
          <PageOptionsMenu
            procedureId={procedure.id}
            contentText={contentText}
            canDuplicate={canEdit}
            canLock={canPublish}
            initialLocked={procedure.isLocked}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent
              className="prose prose-sm max-w-none py-5"
              dangerouslySetInnerHTML={{ __html: renderedContentHtml }}
            />
          </Card>

          {procedure.requiresAck && (
            <AcknowledgeButton procedureId={procedure.id} alreadyAcknowledged={alreadyAcknowledged} />
          )}

          <AttachmentsPanel procedureId={procedure.id} initialAttachments={procedure.attachments} canEdit={canEdit} />

          {procedure.relatedFrom.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Procedure correlate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0">
                {procedure.relatedFrom.map((r) => (
                  <Link
                    key={r.id}
                    href={`/procedures/${r.to.id}`}
                    className="block text-sm text-primary hover:underline"
                  >
                    {r.to.code} — {r.to.title}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <div id="commenti">
            <CommentThread
              procedureId={procedure.id}
              currentUserId={userId}
              isAdmin={globalRole === "ADMIN"}
              comments={procedure.comments.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: c.createdAt.toISOString(),
                author: c.author,
                replies: c.replies.map((r) => ({
                  id: r.id,
                  body: r.body,
                  createdAt: r.createdAt.toISOString(),
                  author: r.author,
                })),
              }))}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <ReadingOutline headings={tocHeadings} />

          <WorkflowPanel
            procedureId={procedure.id}
            status={procedure.status}
            pendingStepId={pendingStep?.id ?? null}
            pendingStage={pendingStep?.stage ?? null}
            canSubmit={canEdit}
            canDecide={canDecide}
            canArchive={canPublish}
          />

          {procedure.requiresAck && canSeeAckDashboard && <AckDashboard procedureId={procedure.id} />}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Dettagli</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm">
              <dl className="space-y-2 text-muted-foreground">
                <div className="flex justify-between">
                  <dt>Autore</dt>
                  <dd className="text-foreground">{procedure.author.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Owner</dt>
                  <dd className="text-foreground">{procedure.owner?.name ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Ultima revisione</dt>
                  <dd className="text-foreground">{procedure.reviewDate ? formatDate(procedure.reviewDate) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Prossima revisione</dt>
                  <dd className="text-foreground">{procedure.nextReviewDate ? formatDate(procedure.nextReviewDate) : "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Versione corrente</dt>
                  <dd className="font-mono text-foreground">v{procedure.currentVersion?.versionNumber ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="h-4 w-4" /> Cronologia versioni
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <VersionHistory
                procedureId={procedure.id}
                versions={procedure.versions.map((v) => ({
                  id: v.id,
                  versionNumber: v.versionNumber,
                  createdAt: v.createdAt.toISOString(),
                  authorName: v.author.name,
                  changelog: v.changelog,
                }))}
              />
            </CardContent>
          </Card>
        </aside>
      </div>
    </ProcedureViewShell>
  );
}
