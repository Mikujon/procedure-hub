"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BlockEditor } from "@/components/blocks/block-editor";
import type { ClientBlock } from "@/components/blocks/types";
import { EmojiPicker } from "@/components/pages/emoji-picker";
import { AiToolbarTrigger } from "@/components/ai/ai-toolbar-trigger";
import { SuggestionPanel } from "@/components/ai/suggestion-panel";
import { PromoteToProcedureDialog } from "@/components/pages/promote-to-procedure-dialog";
import { Plus, Trash2, Check, Loader2, FileText, ChevronRight, Lock, ShieldCheck } from "lucide-react";

interface PageData {
  id: string;
  title: string;
  icon: string | null;
  parent: { id: string; title: string; icon: string | null } | null;
  children: { id: string; title: string; icon: string | null }[];
  procedure: { id: string; departmentId: string; status: string } | null;
}

type SaveState = "idle" | "saving" | "saved";

export default function WorkspacePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [page, setPage] = useState<PageData | null>(null);
  const [blocks, setBlocks] = useState<ClientBlock[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [suggestionsKey, setSuggestionsKey] = useState(0);
  const [promoteOpen, setPromoteOpen] = useState(false);

  // Load (re-runs when navigating between pages).
  useEffect(() => {
    let active = true;
    setPage(null);
    setBlocks(null);
    setNotFound(false);

    Promise.all([
      fetch(`/api/pages/${params.id}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      fetch(`/api/pages/${params.id}/blocks`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
    ])
      .then(([pageData, blocksData]) => {
        if (!active) return;
        setPage(pageData.page);
        setTitle(pageData.page.title);
        setIcon(pageData.page.icon);
        setCanEdit(pageData.canEdit !== false);
        setBlocks(blocksData.blocks ?? []);
      })
      .catch(() => active && setNotFound(true));
    return () => {
      active = false;
    };
  }, [params.id]);

  // A page promoted to a Documento Controllato is governed via the existing
  // /procedures/[id] detail page (workflow, versioning, Read & Ack panels
  // already live there) rather than duplicating that UI here.
  useEffect(() => {
    if (page?.procedure) router.replace(`/procedures/${page.procedure.id}`);
  }, [page, router]);

  // Title/icon still autosave through PATCH /api/pages/[id] — block content
  // no longer goes through here, each block autosaves itself (Fase 2b).
  const saveMeta = useCallback(
    (patch: Record<string, any>) => {
      setSaveState("saving");
      fetch(`/api/pages/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(() => {
        window.dispatchEvent(new Event("pages:changed"));
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      });
    },
    [params.id]
  );

  function onTitle(v: string) {
    setTitle(v);
    saveMeta({ title: v || "Senza titolo" });
  }
  function onIcon(v: string | null) {
    setIcon(v);
    setShowPicker(false);
    saveMeta({ icon: v });
  }

  async function addSubpage() {
    const res = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: params.id }),
    });
    const { page: created } = await res.json();
    router.push(`/pages/${created.id}`);
  }

  async function remove() {
    if (!confirm("Archiviare questa pagina e le sue sottopagine?")) return;
    await fetch(`/api/pages/${params.id}`, { method: "DELETE" });
    router.push(page?.parent ? `/pages/${page.parent.id}` : "/dashboard");
    router.refresh();
  }

  if (notFound) {
    return <p className="mx-auto max-w-3xl text-sm text-muted-foreground">Pagina non trovata o archiviata.</p>;
  }
  if (!page || blocks === null || page.procedure) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const collabUser = { name: session?.user?.name ?? "Utente", color: "#2F5D8C" };

  return (
    <div className="mx-auto max-w-3xl">
      {/* breadcrumb + save state */}
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          {page.parent && (
            <>
              <Link href={`/pages/${page.parent.id}`} className="flex items-center gap-1 hover:text-foreground">
                <span>{page.parent.icon ?? "📄"}</span>
                <span className="max-w-[160px] truncate">{page.parent.title || "Senza titolo"}</span>
              </Link>
              <ChevronRight className="h-3 w-3" />
            </>
          )}
          <span className="text-foreground">{title || "Senza titolo"}</span>
        </div>
        <div className="flex items-center gap-3">
          {canEdit ? (
            <>
              <span className="flex items-center gap-1">
                {saveState === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
                {saveState === "saved" && <Check className="h-3 w-3 text-stamp-green" />}
                {saveState === "saving" ? "Salvataggio…" : saveState === "saved" ? "Salvato" : ""}
              </span>
              <AiToolbarTrigger pageId={params.id} onSuggestionCreated={() => setSuggestionsKey((k) => k + 1)} />
              <button
                onClick={() => setPromoteOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Rendi Pagina Ufficiale
              </button>
              <button onClick={remove} className="flex items-center gap-1 hover:text-destructive" title="Archivia pagina">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              <Lock className="h-3 w-3" /> Sola lettura
            </span>
          )}
        </div>
      </div>

      {/* icon + title */}
      <div className="relative mb-2">
        <button
          onClick={() => canEdit && setShowPicker((s) => !s)}
          className={`flex h-14 w-14 items-center justify-center rounded-lg text-4xl ${canEdit ? "hover:bg-muted" : "cursor-default"}`}
          title={canEdit ? "Cambia icona" : ""}
        >
          {icon ?? <FileText className="h-8 w-8 text-muted-foreground/50" />}
        </button>
        {showPicker && canEdit && <EmojiPicker current={icon} onSelect={onIcon} onClose={() => setShowPicker(false)} />}
      </div>

      {canEdit ? (
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Senza titolo"
          className="mb-4 w-full bg-transparent font-display text-4xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40"
        />
      ) : (
        <h1 className="mb-4 font-display text-4xl font-bold tracking-tight">{title || "Senza titolo"}</h1>
      )}

      {canEdit && <SuggestionPanel pageId={params.id} refreshKey={suggestionsKey} />}

      {/* block editor — each block autosaves itself, no page-level content save */}
      <BlockEditor
        parent={{ type: "page", id: params.id }}
        initialBlocks={blocks}
        editable={canEdit}
        collabToken={null}
        user={collabUser}
      />

      {/* subpages */}
      {(canEdit || page.children.length > 0) && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Sottopagine</p>
            {canEdit && (
              <button onClick={addSubpage} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="h-3.5 w-3.5" /> Aggiungi
              </button>
            )}
          </div>
          {page.children.length === 0 ? (
            canEdit && (
              <button
                onClick={addSubpage}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                <Plus className="h-4 w-4" /> Nuova sottopagina
              </button>
            )
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {page.children.map((c) => (
                <Link key={c.id} href={`/pages/${c.id}`} className="flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted">
                  <span>{c.icon ?? "📄"}</span>
                  <span className="truncate">{c.title || "Senza titolo"}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {promoteOpen && (
        <PromoteToProcedureDialog
          pageId={params.id}
          onClose={() => setPromoteOpen(false)}
          onPromoted={(procedureId) => router.push(`/procedures/${procedureId}`)}
        />
      )}
    </div>
  );
}
