"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Non-text block types: no Yjs involved (their content is a small, atomic
 * JSON value, not free-flowing prose that benefits from CRDT merge), edits
 * go straight through PATCH /api/blocks/[id] on blur. Kept as one file
 * rather than one-component-per-type — these are small and share the same
 * "local state until blur, then persist" shape.
 */

interface BlockEditProps<T> {
  content: T;
  editable: boolean;
  onChange: (content: T) => void;
}

export function DividerBlock() {
  return <hr className="my-2 border-border" />;
}

export function ImageBlock({ content, editable, onChange }: BlockEditProps<{ url?: string; caption?: string }>) {
  const [url, setUrl] = useState(content?.url ?? "");
  const [caption, setCaption] = useState(content?.caption ?? "");

  if (!content?.url && !editable) return null;

  if (!content?.url) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL immagine…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => url.trim() && onChange({ url: url.trim(), caption })}
          className="shrink-0 rounded-sm bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          Inserisci
        </button>
      </div>
    );
  }

  return (
    <figure className="space-y-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={content.url} alt={content.caption ?? ""} className="max-w-full rounded-sm border border-border" />
      {editable ? (
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => onChange({ url: content.url, caption })}
          placeholder="Didascalia (opzionale)"
          className="w-full bg-transparent text-xs text-muted-foreground outline-none"
        />
      ) : content.caption ? (
        <figcaption className="text-xs text-muted-foreground">{content.caption}</figcaption>
      ) : null}
    </figure>
  );
}

export function VideoBlock({ content, editable, onChange }: BlockEditProps<{ url?: string }>) {
  const [url, setUrl] = useState(content?.url ?? "");

  if (!content?.url) {
    if (!editable) return null;
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL video (YouTube)…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => url.trim() && onChange({ url: url.trim() })}
          className="shrink-0 rounded-sm bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          Inserisci
        </button>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-sm border border-border">
      <iframe src={content.url} className="h-full w-full" allowFullScreen title="Video" />
    </div>
  );
}

/** Generic "incorpora" block — any URL that renders in an iframe (Figma, Google Docs/Sheets embed links, Loom, Miro, CodePen, …). Unlike VideoBlock this isn't scoped to one provider, so there's no reliable way to detect an embed that a host blocks via X-Frame-Options short of trying it — the "Apri in una nuova scheda" link is the real fallback for those. Published read view gets the same iframe (see lib/embedded-blocks.ts's injectEmbedIframes, spliced into contentHtml after generateHTML — same trust level VIDEO's Tiptap Youtube node already gets there). */
export function EmbedBlock({ content, editable, onChange }: BlockEditProps<{ url?: string; caption?: string }>) {
  const [url, setUrl] = useState(content?.url ?? "");
  const [caption, setCaption] = useState(content?.caption ?? "");

  if (!content?.url) {
    if (!editable) return null;
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border p-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL da incorporare (Figma, Google Docs, Loom, …)…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => url.trim() && onChange({ url: url.trim(), caption })}
          className="shrink-0 rounded-sm bg-primary px-2 py-1 text-xs text-primary-foreground"
        >
          Inserisci
        </button>
      </div>
    );
  }

  return (
    <figure className="space-y-1.5">
      <div className="aspect-video w-full overflow-hidden rounded-sm border border-border">
        <iframe src={content.url} className="h-full w-full" title="Contenuto incorporato" />
      </div>
      <div className="flex items-center justify-between gap-2">
        {editable ? (
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => onChange({ url: content.url, caption })}
            placeholder="Didascalia (opzionale)"
            className="min-w-0 flex-1 bg-transparent text-xs text-muted-foreground outline-none"
          />
        ) : content.caption ? (
          <figcaption className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{content.caption}</figcaption>
        ) : (
          <span />
        )}
        <a href={content.url} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-primary hover:underline">
          Apri in una nuova scheda ↗
        </a>
      </div>
    </figure>
  );
}

export function CodeBlock({ content, editable, onChange }: BlockEditProps<{ code?: string; language?: string | null }>) {
  const [code, setCode] = useState(content?.code ?? "");
  const [language, setLanguage] = useState(content?.language ?? "");

  return (
    <div className="rounded-md border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        <input
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          onBlur={() => onChange({ code, language: language || null })}
          placeholder="linguaggio"
          disabled={!editable}
          className="w-32 bg-transparent font-mono text-xs text-muted-foreground outline-none"
        />
      </div>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onBlur={() => onChange({ code, language: language || null })}
        readOnly={!editable}
        rows={Math.max(3, code.split("\n").length)}
        className="w-full resize-y bg-transparent px-3 py-2 font-mono text-sm outline-none"
        spellCheck={false}
      />
    </div>
  );
}

/** mermaid is loaded once per browser tab (module-level, not per-block) — it's a sizeable client bundle and mermaid.initialize() is itself global state, so re-initializing per DiagramBlock instance would be wasted work at best and conflicting config at worst. */
let mermaidInitDone = false;
async function ensureMermaid() {
  const mermaid = (await import("mermaid")).default;
  if (!mermaidInitDone) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
    mermaidInitDone = true;
  }
  return mermaid;
}

/** Mermaid flowchart/sequence/etc. diagram — genuinely useful in a procedure hub for the thing procedures already describe in prose (approval flows, escalation paths). Renders live in the editor via the mermaid package (dynamic import — it needs a real DOM, so it can't load at module-eval time in a server-rendered app); the published read view gets the same treatment client-side (components/procedures/mermaid-renderer.tsx) since contentHtml itself can only carry the raw source (see lib/blocks/serialize.ts + lib/embedded-blocks.ts). */
export function DiagramBlock({ content, editable, onChange }: BlockEditProps<{ code?: string }>) {
  const [code, setCode] = useState(content?.code ?? "");
  const previewRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const renderSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const seq = ++renderSeq.current;

    async function render() {
      if (!code.trim()) {
        if (previewRef.current) previewRef.current.innerHTML = "";
        setError(null);
        return;
      }
      try {
        const mermaid = await ensureMermaid();
        const id = `mermaid-edit-${seq}-${Math.random().toString(36).slice(2, 8)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && previewRef.current) {
          previewRef.current.innerHTML = svg;
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Sintassi Mermaid non valida — anteprima non disponibile finché non viene corretta.");
      }
    }

    // Debounced — re-parsing (and flashing a syntax error) on every keystroke while someone is mid-diagram would be noisy, not helpful.
    const t = setTimeout(render, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code]);

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
      {editable && (
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onBlur={() => onChange({ code })}
          placeholder={"Sintassi Mermaid, es.:\ngraph TD\n  A[Richiesta ricevuta] --> B{Approvata?}\n  B -->|Si| C[Pubblica]\n  B -->|No| D[Rifiuta]"}
          rows={Math.max(4, code.split("\n").length)}
          className="w-full resize-y rounded-sm border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none"
          spellCheck={false}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {(code.trim() || editable) && <div ref={previewRef} className="overflow-x-auto [&_svg]:mx-auto" />}
    </div>
  );
}

export function TableSimpleBlock({ content, editable, onChange }: BlockEditProps<{ rows?: string[][] }>) {
  const rows: string[][] = content?.rows?.length ? content.rows : [["", ""], ["", ""]];

  function setCell(r: number, c: number, value: string) {
    const next = rows.map((row) => [...row]);
    next[r][c] = value;
    onChange({ rows: next });
  }

  function addRow() {
    onChange({ rows: [...rows, rows[0].map(() => "")] });
  }

  function addColumn() {
    onChange({ rows: rows.map((row) => [...row, ""]) });
  }

  return (
    <div className="space-y-2">
      <table className="w-full border-collapse overflow-hidden rounded-sm border border-border text-sm">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className={r === 0 ? "bg-muted/50 font-medium" : undefined}>
              {row.map((cell, c) => (
                <td key={c} className="border border-border p-0">
                  <input
                    value={cell}
                    onChange={(e) => setCell(r, c, e.target.value)}
                    disabled={!editable}
                    className="w-full bg-transparent px-2 py-1 outline-none"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <div className="flex gap-2 text-xs text-muted-foreground">
          <button type="button" onClick={addRow} className="hover:text-foreground">+ riga</button>
          <button type="button" onClick={addColumn} className="hover:text-foreground">+ colonna</button>
        </div>
      )}
    </div>
  );
}
