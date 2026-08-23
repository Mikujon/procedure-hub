"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, Send, Loader2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Source {
  id: string;
  title: string;
  code: string;
}

interface Turn {
  question: string;
  answer: string;
  sources: Source[];
  streaming: boolean;
}

/**
 * Notion-AI-style Q&A over published procedures — Fase 5 Parte C. Reads a
 * streamed plain-text body (POST /api/ai/ask) chunk by chunk via a raw
 * fetch + ReadableStream reader (no SDK needed for a plain-text stream),
 * and pulls the source list out of the X-Ai-Sources response header, which
 * arrives before the body does.
 */
export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setQuestion("");
    setError(null);
    setBusy(true);
    setTurns((prev) => [...prev, { question: q, answer: "", sources: [], streaming: true }]);

    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok || !res.body) throw new Error(`Richiesta fallita (${res.status})`);

      let sources: Source[] = [];
      const rawSources = res.headers.get("X-Ai-Sources");
      if (rawSources) {
        try {
          sources = JSON.parse(decodeURIComponent(rawSources));
        } catch {
          sources = [];
        }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setTurns((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], answer: accumulated, sources };
          return next;
        });
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
      setTurns((prev) => {
        const next = [...prev];
        next[next.length - 1] = { ...next[next.length - 1], streaming: false };
        return next;
      });
    } catch (e: any) {
      setError(e.message ?? "Errore imprevisto");
      setTurns((prev) => prev.slice(0, -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-6 flex items-center gap-2 opacity-0 animate-rise">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold tracking-tight">Chiedi</h1>
      </div>

      {turns.length === 0 && (
        <p className="mb-6 text-sm text-muted-foreground opacity-0 animate-rise" style={{ animationDelay: "60ms" }}>
          Fai una domanda in linguaggio naturale sulle procedure pubblicate — es. &quot;qual è la procedura per l&apos;onboarding IT?&quot;.
          Rispondo solo sulla base di procedure pubblicate esistenti, citando sempre la fonte.
        </p>
      )}

      <div className="space-y-6">
        {turns.map((t, i) => (
          <div key={i} className="space-y-2 opacity-0 animate-rise">
            <p className="font-medium text-foreground">{t.question}</p>
            <Card className="p-4 text-sm leading-relaxed">
              {t.answer || (t.streaming && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />)}
              {t.streaming && t.answer && <span className="animate-pulse">▍</span>}
            </Card>
            {t.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {t.sources.map((s) => (
                  <Link
                    key={s.id}
                    href={`/procedures/${s.id}`}
                    className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <FileText className="h-3 w-3" /> {s.code} — {s.title}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <Card className="sticky bottom-6 mt-6 flex flex-row items-center gap-2 p-2 opacity-0 animate-rise shadow-lg">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Fai una domanda…"
          disabled={busy}
          className="flex-1 border-0 shadow-none focus-visible:ring-0"
        />
        <Button onClick={ask} disabled={busy || !question.trim()} size="icon" className="shrink-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </Card>
    </div>
  );
}
