"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronRight, Plus, FileText, Loader2, Table2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplatePickerDialog } from "./template-picker-dialog";

interface PageNode {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
}

interface DbNode {
  id: string;
  title: string;
  icon: string | null;
}

interface TemplateNode {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
}

export function PageTree({ canEdit = false }: { canEdit?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pages, setPages] = useState<PageNode[]>([]);
  const [databases, setDatabases] = useState<DbNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateNode[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, dRes] = await Promise.all([fetch("/api/pages"), fetch("/api/databases")]);
      const pData = await pRes.json();
      const dData = await dRes.json();
      setPages(pData.pages ?? []);
      setDatabases(dData.databases ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);

  // Live-refresh when a page's title/icon changes elsewhere (e.g. the editor).
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("pages:changed", handler);
    return () => window.removeEventListener("pages:changed", handler);
  }, [load]);

  const childrenOf = (parentId: string | null) => pages.filter((p) => p.parentId === parentId);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function createPage(parentId: string | null) {
    setCreating(true);
    setMenuOpen(false);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId }),
      });
      const { page } = await res.json();
      if (parentId) setExpanded((s) => new Set(s).add(parentId));
      await load();
      router.push(`/pages/${page.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function openTemplatePicker() {
    setMenuOpen(false);
    setTemplatePickerOpen(true);
    if (templates.length === 0) {
      setTemplatesLoading(true);
      try {
        const res = await fetch("/api/templates");
        const data = await res.json();
        setTemplates(data.templates ?? []);
      } finally {
        setTemplatesLoading(false);
      }
    }
  }

  async function createFromTemplate(templateId: string) {
    setCreating(true);
    setTemplatePickerOpen(false);
    try {
      const res = await fetch("/api/pages/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, parentId: null }),
      });
      const { page } = await res.json();
      await load();
      router.push(`/pages/${page.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function createDatabase() {
    setCreating(true);
    setMenuOpen(false);
    try {
      const res = await fetch("/api/databases", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const { database } = await res.json();
      await load();
      router.push(`/databases/${database.id}`);
    } finally {
      setCreating(false);
    }
  }

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function renderNode(node: PageNode, depth: number) {
    const kids = childrenOf(node.id);
    const isOpen = expanded.has(node.id);
    const active = pathname === `/pages/${node.id}`;
    return (
      <div key={node.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-md pr-1 text-sm transition-colors",
            active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            onClick={() => (kids.length ? toggle(node.id) : canEdit ? createPage(node.id) : router.push(`/pages/${node.id}`))}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-border/60"
            title={kids.length ? "Espandi" : canEdit ? "Aggiungi sottopagina" : ""}
          >
            {kids.length > 0 ? (
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
            ) : (
              <span className="text-xs opacity-0 group-hover:opacity-60">·</span>
            )}
          </button>
          <button
            onClick={() => router.push(`/pages/${node.id}`)}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
          >
            <span className="shrink-0 text-sm leading-none">
              {node.icon ? node.icon : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
            <span className="truncate">{node.title || "Senza titolo"}</span>
          </button>
          {canEdit && (
            <button
              onClick={() => createPage(node.id)}
              className="hidden h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-border/60 group-hover:flex"
              title="Aggiungi sottopagina"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isOpen && kids.map((k) => renderNode(k, depth + 1))}
      </div>
    );
  }

  const roots = childrenOf(null);

  return (
    <div className="mt-6">
      <div className="relative flex items-center justify-between px-3" ref={menuRef}>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
        {canEdit && (
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={creating}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Aggiungi"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        )}
        {menuOpen && canEdit && (
          <div className="absolute right-2 top-6 z-50 w-44 rounded-lg border border-border bg-card p-1.5 shadow-xl">
            <button onClick={() => createPage(null)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Pagina
            </button>
            <button onClick={openTemplatePicker} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Da modello
            </button>
            <button onClick={createDatabase} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
              <Table2 className="h-3.5 w-3.5 text-muted-foreground" /> Database
            </button>
          </div>
        )}
        <TemplatePickerDialog
          open={templatePickerOpen}
          onOpenChange={setTemplatePickerOpen}
          templates={templates}
          loading={templatesLoading}
          onSelect={createFromTemplate}
        />
      </div>

      <div className="mt-2 space-y-0.5">
        {loading ? (
          <p className="px-3 py-1 text-xs text-muted-foreground">Caricamento…</p>
        ) : roots.length === 0 ? (
          canEdit ? (
            <button
              onClick={() => createPage(null)}
              className="mx-1 flex w-[calc(100%-8px)] items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              <Plus className="h-3.5 w-3.5" /> Crea la prima pagina
            </button>
          ) : (
            <p className="px-3 py-1 text-xs text-muted-foreground">Nessuna pagina ancora.</p>
          )
        ) : (
          roots.map((r) => renderNode(r, 0))
        )}

        {databases.map((d) => {
          const active = pathname === `/databases/${d.id}`;
          return (
            <button
              key={d.id}
              onClick={() => router.push(`/databases/${d.id}`)}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-md py-1.5 pl-[26px] pr-2 text-left text-sm transition-colors",
                active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="shrink-0 text-sm leading-none">
                {d.icon ? d.icon : <Table2 className="h-3.5 w-3.5" />}
              </span>
              <span className="truncate">{d.title || "Database"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
