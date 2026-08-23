"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, Layers, FileText, ListChecks, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProcessNode {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ProcedureNode {
  id: string;
  code: string;
  title: string;
  status: string;
  isCritical: boolean;
  processId: string | null;
  parentId: string | null;
}

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-muted-foreground/40",
  IN_REVIEW: "bg-primary",
  COMPLIANCE_APPROVAL: "bg-[hsl(var(--stamp-amber))]",
  MANAGEMENT_APPROVAL: "bg-[hsl(var(--stamp-amber))]",
  PUBLISHED: "bg-[hsl(var(--stamp-green))]",
  ARCHIVED: "bg-muted-foreground/40",
  REJECTED: "bg-destructive",
};

/**
 * Department -> Process -> Procedure -> Work Instruction navigator.
 * Fetches GET /api/departments/[id]/tree once (flat lists) and builds the
 * tree client-side by parentId/processId — same pattern as PageTree for
 * Workspace pages, so a Notion-trained eye recognizes the interaction
 * immediately: chevron toggles, clicking the label navigates.
 *
 * One component, two mounting contexts (the redesign plan's "stesso
 * componente riusato in due punti"):
 *  - variant="sidebar": compact rows, mounted only once a department is
 *    expanded in the Sidebar (mount-on-demand IS the lazy-load — no fetch
 *    happens for a department the user never opens).
 *  - variant="page": fuller rows (status dot + code), mounted immediately
 *    on the department page, first level auto-expanded.
 */
export function DepartmentTree({
  departmentId,
  variant = "sidebar",
  baseDepth = 0,
  revealProcedureId,
}: {
  departmentId: string;
  variant?: "sidebar" | "page";
  baseDepth?: number;
  /** Auto-expand every ancestor (process chain + parent Work Instructions)
   *  of this procedure and scroll it into view — "always know where you
   *  are", the GitHub/VS Code file-explorer behavior of revealing the
   *  currently open file even when you didn't get there by clicking the
   *  tree itself (search, breadcrumb, a direct link, a notification…). */
  revealProcedureId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [processes, setProcesses] = useState<ProcessNode[]>([]);
  const [procedures, setProcedures] = useState<ProcedureNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/departments/${departmentId}/tree`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const loadedProcesses: ProcessNode[] = data.processes ?? [];
        setProcesses(loadedProcesses);
        setProcedures(data.procedures ?? []);
        if (variant === "page") {
          // First level open by default on the dedicated page — an
          // "explorer" that starts fully collapsed reads as empty.
          const rootProcessKeys = loadedProcesses.filter((p) => p.parentId === null).map((p) => `process:${p.id}`);
          setExpanded(new Set(rootProcessKeys));
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [departmentId, variant]);

  // Reveal: walk the ancestor chain of revealProcedureId (parent Work
  // Instructions, then each one's process and that process's own parent
  // chain) and merge those keys into `expanded` — additive, never collapses
  // whatever the user already had open by hand.
  useEffect(() => {
    if (!revealProcedureId || loading) return;
    const keys: string[] = [];
    let cur = procedures.find((p) => p.id === revealProcedureId);
    while (cur) {
      if (cur.parentId) keys.push(`procedure:${cur.parentId}`);
      let proc = cur.processId ? processes.find((pr) => pr.id === cur!.processId) : undefined;
      while (proc) {
        keys.push(`process:${proc.id}`);
        proc = proc.parentId ? processes.find((pr) => pr.id === proc!.parentId) : undefined;
      }
      cur = cur.parentId ? procedures.find((p) => p.id === cur!.parentId) : undefined;
    }
    if (keys.length > 0) {
      setExpanded((prev) => new Set([...prev, ...keys]));
    }
    // Scroll the revealed row into view once the DOM has the newly
    // expanded rows (next paint).
    const t = setTimeout(() => {
      document.getElementById(`tree-row-${variant}-${revealProcedureId}`)?.scrollIntoView({ block: "nearest" });
    }, 50);
    return () => clearTimeout(t);
  }, [revealProcedureId, procedures, processes, loading]);

  function toggle(key: string) {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const childProcesses = (parentId: string | null) => processes.filter((p) => p.parentId === parentId);
  const childProceduresOfProcess = (processId: string | null) =>
    procedures.filter((p) => p.processId === processId && p.parentId === null);
  const workInstructionsOf = (procedureId: string) => procedures.filter((p) => p.parentId === procedureId);

  const rowPad = variant === "sidebar" ? "py-1.5" : "py-2";
  const indentStep = 12;

  function renderProcess(node: ProcessNode, depth: number) {
    const key = `process:${node.id}`;
    const kids = childProcesses(node.id);
    const procKids = childProceduresOfProcess(node.id);
    const hasChildren = kids.length > 0 || procKids.length > 0;
    const isOpen = expanded.has(key);
    return (
      <div key={key}>
        <div
          className="group flex items-center gap-1 rounded-md pr-1 text-sm text-muted-foreground"
          style={{ paddingLeft: 4 + depth * indentStep }}
        >
          <button
            onClick={() => hasChildren && toggle(key)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-border/60"
            title={hasChildren ? "Espandi" : undefined}
          >
            {hasChildren ? (
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
            ) : (
              <span className="text-xs opacity-0">·</span>
            )}
          </button>
          <span className={cn("flex min-w-0 flex-1 items-center gap-1.5", rowPad)}>
            <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{node.name}</span>
          </span>
        </div>
        {isOpen && (
          <>
            {kids.map((k) => renderProcess(k, depth + 1))}
            {procKids.map((p) => renderProcedure(p, depth + 1))}
          </>
        )}
      </div>
    );
  }

  function renderProcedure(node: ProcedureNode, depth: number) {
    const key = `procedure:${node.id}`;
    const wis = workInstructionsOf(node.id);
    const hasChildren = wis.length > 0;
    const isOpen = expanded.has(key);
    const active = pathname === `/procedures/${node.id}`;
    const isWorkInstruction = node.parentId !== null;
    const Icon = isWorkInstruction ? ListChecks : FileText;
    return (
      <div key={key}>
        <div
          id={`tree-row-${variant}-${node.id}`}
          className={cn(
            "group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
            active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          style={{ paddingLeft: 4 + depth * indentStep }}
        >
          <button
            onClick={() => (hasChildren ? toggle(key) : router.push(`/procedures/${node.id}`))}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-border/60"
            title={hasChildren ? "Espandi" : undefined}
          >
            {hasChildren ? (
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
            ) : (
              <span className="text-xs opacity-0 group-hover:opacity-60">·</span>
            )}
          </button>
          <button
            onClick={() => router.push(`/procedures/${node.id}`)}
            className={cn("flex min-w-0 flex-1 items-center gap-1.5 text-left", rowPad)}
          >
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[node.status] ?? STATUS_DOT.DRAFT)} title={node.status} />
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{node.title || "Senza titolo"}</span>
            {variant === "page" && <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground/70">{node.code}</span>}
          </button>
        </div>
        {isOpen && wis.map((wi) => renderProcedure(wi, depth + 1))}
      </div>
    );
  }

  const rootProcesses = childProcesses(null);
  const rootProcedures = childProceduresOfProcess(null);

  if (loading) {
    return (
      <div style={{ paddingLeft: 4 + baseDepth * indentStep }} className="flex items-center gap-1.5 px-3 py-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Caricamento…
      </div>
    );
  }

  if (rootProcesses.length === 0 && rootProcedures.length === 0) {
    return (
      <p style={{ paddingLeft: 4 + baseDepth * indentStep }} className="px-3 py-1 text-xs text-muted-foreground">
        Nessuna procedura ancora.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {rootProcesses.map((p) => renderProcess(p, baseDepth))}
      {rootProcedures.map((p) => renderProcedure(p, baseDepth))}
    </div>
  );
}
