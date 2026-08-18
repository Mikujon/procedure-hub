"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";

interface RelatedRowOption {
  id: string;
  title: string;
}

export function RelationChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
      <Link2 className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/**
 * A relation cell: shows chips for linked rows (resolved by fetching the
 * target database's rows on open — no separate "row title" lookup endpoint
 * exists, and this popover is the only place that needs it); click to open
 * a searchable multi-select of the target database's rows.
 */
export function RelationCell({
  targetDatabaseId,
  value,
  onChange,
  readOnly,
}: {
  targetDatabaseId: string | undefined;
  value: string[] | null | undefined;
  onChange: (ids: string[]) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<RelatedRowOption[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const ids = value ?? [];

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open || !targetDatabaseId || options !== null) return;
    fetch(`/api/databases/${targetDatabaseId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) =>
        setOptions((data.database?.rows ?? []).map((r: any) => ({ id: r.id, title: r.title || "Senza titolo" })))
      )
      .catch(() => setOptions([]));
  }, [open, targetDatabaseId, options]);

  if (!targetDatabaseId) {
    return <span className="block px-3 py-2 text-xs text-muted-foreground/60">Database non configurato</span>;
  }

  const resolved = options ?? [];
  const labelFor = (id: string) => resolved.find((o) => o.id === id)?.title ?? "…";
  const filtered = resolved.filter((o) => o.title.toLowerCase().includes(q.toLowerCase()));

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-1 px-1.5 py-1.5">
        {ids.length === 0 ? (
          <span className="text-sm text-muted-foreground/50">—</span>
        ) : (
          ids.map((id) => <RelationChip key={id} label={labelFor(id)} />)
        )}
      </div>
    );
  }

  function toggle(id: string) {
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-7 w-full flex-wrap items-center gap-1 rounded px-1.5 py-1 hover:bg-muted"
      >
        {ids.length === 0 ? (
          <span className="text-sm text-muted-foreground/50">—</span>
        ) : (
          ids.map((id) => <RelationChip key={id} label={labelFor(id)} />)
        )}
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca righe…"
            className="mb-1.5 w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
          />
          <div className="max-h-56 overflow-y-auto">
            {options === null ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">Caricamento…</p>
            ) : filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">Nessuna riga trovata</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => toggle(o.id)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{o.title}</span>
                  {ids.includes(o.id) && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
