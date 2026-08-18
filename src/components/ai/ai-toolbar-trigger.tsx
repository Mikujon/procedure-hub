"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

interface AiToolbarTriggerProps {
  pageId: string;
  onSuggestionCreated: () => void;
}

type Busy = null | "draft" | "gap" | "related" | "summary";

/** Entry point into Suggest Mode from the editor — analogous to the existing "Commenta" trigger. */
export function AiToolbarTrigger({ pageId, onSuggestionCreated }: AiToolbarTriggerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setDraftOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function run(kind: Busy, path: string, body?: any) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Errore (${res.status})`);
      }
      onSuggestionCreated();
      setMenuOpen(false);
      setDraftOpen(false);
      setTranscript("");
    } catch (e: any) {
      setError(e.message ?? "Errore imprevisto");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Sparkles className="h-3.5 w-3.5" /> Chiedi all&apos;AI
      </button>

      {menuOpen && !draftOpen && (
        <div className="absolute left-0 top-8 z-50 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          <button
            onClick={() => setDraftOpen(true)}
            className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            Genera da conversazione
          </button>
          <button
            onClick={() => run("gap", `/api/pages/${pageId}/ai/gap-analysis`)}
            disabled={busy !== null}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            Analizza lacune {busy === "gap" && <Loader2 className="h-3 w-3 animate-spin" />}
          </button>
          <button
            onClick={() => run("related", `/api/pages/${pageId}/ai/suggest-related`)}
            disabled={busy !== null}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            Documenti correlati {busy === "related" && <Loader2 className="h-3 w-3 animate-spin" />}
          </button>
          <button
            onClick={() => run("summary", `/api/pages/${pageId}/ai/executive-summary`)}
            disabled={busy !== null}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
          >
            Riepilogo esecutivo {busy === "summary" && <Loader2 className="h-3 w-3 animate-spin" />}
          </button>
          {error && <p className="px-2 py-1 text-xs text-destructive">{error}</p>}
        </div>
      )}

      {draftOpen && (
        <div className="absolute left-0 top-8 z-50 w-80 rounded-lg border border-border bg-card p-3 shadow-xl">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Incolla una trascrizione, chat o note libere — l&apos;AI propone una bozza strutturata da rivedere.
          </p>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={6}
            className="mb-2 w-full resize-none rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-primary"
            placeholder="Incolla qui il testo…"
          />
          {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setDraftOpen(false)}
              className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Annulla
            </button>
            <button
              onClick={() => run("draft", `/api/pages/${pageId}/ai/draft-from-conversation`, { transcript })}
              disabled={busy !== null || !transcript.trim()}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy === "draft" && <Loader2 className="h-3 w-3 animate-spin" />} Genera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
