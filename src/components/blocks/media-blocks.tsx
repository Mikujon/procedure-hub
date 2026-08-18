"use client";

import { useState } from "react";

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
