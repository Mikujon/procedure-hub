"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2, Sparkles, AlertTriangle } from "lucide-react";

interface AiSuggestion {
  id: string;
  kind: string;
  proposedContent: { type: string; content: any }[];
  notes: { section: string; issue: string }[] | null;
  createdAt: string;
}

const KIND_LABEL: Record<string, string> = {
  DRAFT_FROM_CONVERSATION: "Bozza da conversazione",
  GAP_ANALYSIS: "Analisi delle lacune",
  SECTION_COMPLETION: "Sezione completata",
  RELATED_DOCUMENT_LINK: "Documenti correlati",
  EXECUTIVE_SUMMARY: "Riepilogo esecutivo",
};

function previewText(node: { type: string; content: any }): string {
  if (node.type === "PAGE_LINK") return `🔗 ${node.content?.title ?? "pagina"}`;
  if (node.type === "TABLE_SIMPLE") return `Tabella (${node.content?.rows?.length ?? 0} righe)`;
  const text = Array.isArray(node.content?.text) ? node.content.text.map((t: any) => t.text).join("") : "";
  return text || "(vuoto)";
}

/** Lists pending AiSuggestions for a page and lets a person accept/reject each — the only path AI content ever reaches real Blocks. */
export function SuggestionPanel({ pageId, refreshKey }: { pageId: string; refreshKey: number }) {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/pages/${pageId}/ai-suggestions`)
      .then((r) => r.json())
      .then((d) => active && setSuggestions(d.suggestions ?? []))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pageId, refreshKey]);

  async function decide(id: string, decision: "ACCEPTED" | "REJECTED") {
    setDeciding(id);
    try {
      await fetch(`/api/ai-suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      if (decision === "ACCEPTED") window.location.reload(); // simplest way to reflect newly-created blocks
    } finally {
      setDeciding(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Caricamento suggerimenti…
      </div>
    );
  }
  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {suggestions.map((s) => (
        <div key={s.id} className="rounded-lg border border-stamp-amber/40 bg-stamp-amber/5 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-stamp-amber">
            <Sparkles className="h-3.5 w-3.5" /> {KIND_LABEL[s.kind] ?? s.kind}
          </div>

          {s.kind === "GAP_ANALYSIS" ? (
            <ul className="mb-3 space-y-1.5 text-sm">
              {(s.notes ?? []).length === 0 ? (
                <li className="text-muted-foreground">Nessuna lacuna rilevata.</li>
              ) : (
                s.notes!.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stamp-amber" />
                    <span>
                      <strong>{n.section}:</strong> {n.issue}
                    </span>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <ul className="mb-3 space-y-1 text-sm text-foreground/90">
              {s.proposedContent.length === 0 ? (
                <li className="text-muted-foreground">Nessuna proposta.</li>
              ) : (
                s.proposedContent.map((n, i) => (
                  <li key={i} className="truncate">
                    {previewText(n)}
                  </li>
                ))
              )}
            </ul>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => decide(s.id, "ACCEPTED")}
              disabled={deciding === s.id}
              className="flex items-center gap-1 rounded-md bg-stamp-green px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {deciding === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Accetta
            </button>
            <button
              onClick={() => decide(s.id, "REJECTED")}
              disabled={deciding === s.id}
              className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              <X className="h-3 w-3" /> Rifiuta
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
