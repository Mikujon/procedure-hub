"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SelectChip } from "./select-cell";
import { formatCellValue } from "./helpers";
import type { Database, Property, Row } from "./types";

interface Handlers {
  patchRow: (rowId: string, patch: { title?: string; values?: Record<string, any> }) => void;
  addRow: (values?: Record<string, any>, title?: string) => void;
  deleteRow: (rowId: string) => void;
}

/** Card-grid view — same visual language as TemplatePickerDialog's gallery, applied to a database's own rows. */
export function GalleryView({ db, rows, readOnly = false, patchRow, addRow, deleteRow }: {
  db: Database;
  rows: Row[];
  readOnly?: boolean;
} & Handlers) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((row, i) => (
        <div key={row.id} className="opacity-0 animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
          <GalleryCard
            row={row}
            properties={db.properties}
            readOnly={readOnly}
            onTitle={(t) => patchRow(row.id, { title: t })}
            onDelete={() => deleteRow(row.id)}
          />
        </div>
      ))}
      {!readOnly && (
        <button onClick={() => addRow()} className="text-left">
          <Card className="flex h-full min-h-[104px] items-center justify-center gap-1.5 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
            <Plus className="h-4 w-4" /> Nuova scheda
          </Card>
        </button>
      )}
      {rows.length === 0 && readOnly && (
        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Nessuna riga ancora.</p>
      )}
    </div>
  );
}

function GalleryCard({ row, properties, readOnly, onTitle, onDelete }: {
  row: Row; properties: Property[]; readOnly?: boolean; onTitle: (t: string) => void; onDelete: () => void;
}) {
  const [title, setTitle] = useState(row.title);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTitle(row.title); }, [row.title]);

  const chips = properties
    .map((p) => {
      const v = row.values?.[p.id];
      if (v === null || v === undefined || v === "" || v === false) return null;
      if (p.type === "select") {
        const opt = p.options?.find((o) => o.id === v);
        return opt ? <SelectChip key={p.id} option={opt} /> : null;
      }
      if (p.type === "checkbox") return <span key={p.id} className="text-xs text-muted-foreground">✓ {p.name}</span>;
      if (p.type === "relation") return null; // no cross-database preview here — TableView/RelationCell already covers editing it
      return <span key={p.id} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{formatCellValue(p.type, v)}</span>;
    })
    .filter(Boolean);

  return (
    <Card className="group relative h-full p-3">
      {!readOnly && (
        <button
          onClick={onDelete}
          className="absolute right-2 top-2 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-60"
          title="Elimina riga"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {readOnly ? (
        <p className="pr-5 text-sm font-medium">{row.title || <span className="text-muted-foreground/50">Senza titolo</span>}</p>
      ) : (
        <input
          value={title}
          placeholder="Senza titolo"
          onFocus={() => (focused.current = true)}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { focused.current = false; if (title !== row.title) onTitle(title); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full bg-transparent pr-5 text-sm font-medium outline-none placeholder:text-muted-foreground/50"
        />
      )}
      {chips.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{chips}</div>}
    </Card>
  );
}
