"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SelectChip } from "./select-cell";
import { formatCellValue } from "./helpers";
import type { Database, Property, Row, View } from "./types";

interface Handlers {
  patchRow: (rowId: string, patch: { title?: string; values?: Record<string, any> }) => void;
  addRow: (values?: Record<string, any>, title?: string) => void;
  deleteRow: (rowId: string) => void;
  addOption: (propId: string, name: string) => string;
}

export function BoardView({ db, rows, view, readOnly = false, onSetGroupBy, patchRow, addRow, deleteRow }: {
  db: Database;
  rows: Row[];
  view: View;
  readOnly?: boolean;
  onSetGroupBy: (propId: string) => void;
} & Handlers) {
  const selectProps = db.properties.filter((p) => p.type === "select");
  const groupProp = db.properties.find((p) => p.id === view.groupByPropertyId && p.type === "select");

  if (!groupProp) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="mb-3 text-sm text-muted-foreground">
          La bacheca ha bisogno di una proprietà di tipo <strong>Selezione</strong> per raggruppare le schede.
        </p>
        {selectProps.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {selectProps.map((p) => (
              <button key={p.id} onClick={() => onSetGroupBy(p.id)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Raggruppa per “{p.name}”
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aggiungi prima una colonna di tipo Selezione nella vista Tabella.</p>
        )}
      </div>
    );
  }

  const options = groupProp.options ?? [];
  const columns = [
    ...options.map((o) => ({ key: o.id, label: o.name, color: o.color as string | undefined })),
    { key: "__none__", label: "Nessuno", color: undefined as string | undefined },
  ];

  const rowsFor = (colKey: string) =>
    colKey === "__none__"
      ? rows.filter((r) => !options.some((o) => o.id === r.values?.[groupProp.id]))
      : rows.filter((r) => r.values?.[groupProp.id] === colKey);

  function moveTo(rowId: string, colKey: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const val = colKey === "__none__" ? null : colKey;
    if ((row.values?.[groupProp!.id] ?? null) === val) return;
    patchRow(rowId, { values: { ...row.values, [groupProp!.id]: val } });
  }

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <BoardColumn
          key={col.key}
          label={col.label}
          color={col.color}
          count={rowsFor(col.key).length}
          readOnly={readOnly}
          onDropRow={(rowId) => moveTo(rowId, col.key)}
          onAdd={() => addRow(col.key === "__none__" ? {} : { [groupProp.id]: col.key })}
        >
          {rowsFor(col.key).map((row, i) => (
            <div key={row.id} className="opacity-0 animate-rise" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
              <BoardCard
                row={row}
                readOnly={readOnly}
                properties={db.properties.filter((p) => p.id !== groupProp.id)}
                onTitle={(t) => patchRow(row.id, { title: t })}
                onDelete={() => deleteRow(row.id)}
              />
            </div>
          ))}
        </BoardColumn>
      ))}
    </div>
  );
}

function BoardColumn({ label, color, count, children, readOnly, onDropRow, onAdd }: {
  label: string; color?: string; count: number; readOnly?: boolean;
  children: React.ReactNode; onDropRow: (rowId: string) => void; onAdd: () => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={readOnly ? undefined : () => setOver(false)}
      onDrop={readOnly ? undefined : (e) => { e.preventDefault(); setOver(false); const id = e.dataTransfer.getData("text/plain"); if (id) onDropRow(id); }}
      className={`flex w-72 shrink-0 flex-col rounded-lg p-2 transition-colors ${over ? "bg-primary/5" : "bg-muted/40"}`}
    >
      <div className="mb-2 flex items-center gap-2 px-1">
        {color ? <SelectChip option={{ name: label, color }} /> : <span className="text-sm font-medium text-muted-foreground">{label}</span>}
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
      {!readOnly && (
        <button onClick={onAdd} className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-background">
          <Plus className="h-3.5 w-3.5" /> Nuova
        </button>
      )}
    </div>
  );
}

function BoardCard({ row, properties, readOnly, onTitle, onDelete }: {
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
      return <span key={p.id} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{formatCellValue(p.type, v)}</span>;
    })
    .filter(Boolean);

  return (
    <div
      draggable={!readOnly}
      onDragStart={readOnly ? undefined : (e) => { e.dataTransfer.setData("text/plain", row.id); e.dataTransfer.effectAllowed = "move"; }}
      className={`group rounded-md border border-border bg-card p-2.5 shadow-sm ${readOnly ? "" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="flex items-start justify-between gap-1">
        {readOnly ? (
          <span className="w-full text-sm font-medium">{row.title || <span className="text-muted-foreground/50">Senza titolo</span>}</span>
        ) : (
          <input
            value={title}
            placeholder="Senza titolo"
            onFocus={() => (focused.current = true)}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { focused.current = false; if (title !== row.title) onTitle(title); }}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/50"
          />
        )}
        {!readOnly && (
          <button onClick={onDelete} className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-60" title="Elimina">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {chips.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{chips}</div>}
    </div>
  );
}
