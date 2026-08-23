"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProcedureNode } from "@/components/layout/department-tree";

interface CrumbItem {
  id: string;
  label: string;
  href: string;
  isCurrent?: boolean;
}

/**
 * "Innovative touch" from the redesign plan: every navigable crumb opens a
 * dropdown of its siblings (same pattern Notion uses on its own breadcrumb)
 * — lets you jump to a related procedure/department without going back to
 * the tree. Lazily fetches GET /api/departments/[id]/tree (same endpoint
 * DepartmentTree uses) or GET /api/departments, only when a dropdown is
 * actually opened, and only once per mount.
 */
function CrumbDropdown({
  label,
  labelClassName,
  fetchItems,
}: {
  label: string;
  labelClassName?: string;
  fetchItems: () => Promise<CrumbItem[]>;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CrumbItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      setLoading(true);
      try {
        setItems(await fetchItems());
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={toggle}
        className="inline-flex items-center gap-0.5 hover:text-foreground hover:underline"
      >
        <span className={labelClassName}>{label}</span>
        <ChevronDown className="h-2.5 w-2.5 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
          {loading ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Caricamento…</p>
          ) : items && items.length > 0 ? (
            items.map((it) => (
              <button
                key={it.id}
                onClick={() => {
                  setOpen(false);
                  router.push(it.href);
                }}
                className={cn(
                  "block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-muted",
                  it.isCurrent && "font-medium text-foreground"
                )}
              >
                {it.label}
              </button>
            ))
          ) : (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">Nessun altro elemento allo stesso livello.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ProcedureBreadcrumb({
  departmentId,
  departmentSlug,
  departmentName,
  processId,
  processName,
  parentProcedure,
  procedureId,
  procedureCode,
  procedureProcessId,
  procedureParentId,
}: {
  departmentId: string;
  departmentSlug: string;
  departmentName: string;
  processId: string | null;
  processName: string | null;
  /** Set only when this procedure is a Work Instruction (has a parent Procedure). */
  parentProcedure: { id: string; code: string; processId: string | null; parentId: string | null } | null;
  procedureId: string;
  procedureCode: string;
  procedureProcessId: string | null;
  procedureParentId: string | null;
}) {
  async function fetchDepartmentSiblings(): Promise<CrumbItem[]> {
    const res = await fetch("/api/departments");
    const data = await res.json();
    return (data.departments ?? []).map((d: any) => ({
      id: d.id,
      label: d.name,
      href: `/departments/${d.slug}`,
      isCurrent: d.id === departmentId,
    }));
  }

  async function fetchProcedureSiblings(atProcessId: string | null, atParentId: string | null, currentId: string): Promise<CrumbItem[]> {
    const res = await fetch(`/api/departments/${departmentId}/tree`);
    const data = await res.json();
    const procedures: ProcedureNode[] = data.procedures ?? [];
    return procedures
      .filter((p) => p.processId === atProcessId && p.parentId === atParentId)
      .map((p) => ({
        id: p.id,
        label: `${p.code} — ${p.title}`,
        href: `/procedures/${p.id}`,
        isCurrent: p.id === currentId,
      }));
  }

  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <CrumbDropdown label={departmentName} fetchItems={fetchDepartmentSiblings} />

      {processName && (
        <>
          <span>/</span>
          {/* Process non ha ancora una pagina dedicata — resta testo semplice,
              non promesso come navigabile finché quella pagina non esiste. */}
          <span>{processName}</span>
        </>
      )}

      {parentProcedure && (
        <>
          <span>/</span>
          <CrumbDropdown
            label={parentProcedure.code}
            labelClassName="font-mono"
            fetchItems={() => fetchProcedureSiblings(parentProcedure.processId, parentProcedure.parentId, parentProcedure.id)}
          />
        </>
      )}

      <span>/</span>
      <CrumbDropdown
        label={procedureCode}
        labelClassName="font-mono"
        fetchItems={() => fetchProcedureSiblings(procedureProcessId, procedureParentId, procedureId)}
      />
    </div>
  );
}
