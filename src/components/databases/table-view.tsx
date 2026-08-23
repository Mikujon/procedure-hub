"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Type, Hash, Calendar, CheckSquare, ChevronDown, X, Link2, ArrowLeft } from "lucide-react";
import { SelectCell, SelectChip } from "./select-cell";
import { RelationCell } from "./relation-cell";
import { formatCellValue } from "./helpers";
import { PROPERTY_TYPE_LABEL, type Database, type Property, type PropertyType, type Row } from "./types";

interface Handlers {
  patchRow: (rowId: string, patch: { title?: string; values?: Record<string, any> }) => void;
  addRow: (values?: Record<string, any>, title?: string) => void;
  deleteRow: (rowId: string) => void;
  addProperty: (type: PropertyType, extra?: Partial<Property>) => void;
  renameProperty: (propId: string, name: string) => void;
  deleteProperty: (propId: string) => void;
  addOption: (propId: string, name: string) => string;
}

const TYPE_ICON: Record<PropertyType, React.ComponentType<{ className?: string }>> = {
  text: Type, number: Hash, select: ChevronDown, date: Calendar, checkbox: CheckSquare, relation: Link2,
};

export function TableView({ db, rows, readOnly = false, patchRow, addRow, deleteRow, addProperty, renameProperty, deleteProperty, addOption }: { db: Database; rows: Row[]; readOnly?: boolean } & Handlers) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="w-8 border-r border-border" />
            <th className="min-w-[220px] border-r border-border px-3 py-2 font-medium text-muted-foreground">Titolo</th>
            {db.properties.map((p) => (
              <ColumnHeader key={p.id} property={p} readOnly={readOnly} onRename={renameProperty} onDelete={deleteProperty} />
            ))}
            <th className="px-2 py-2">{!readOnly && <AddColumn onAdd={addProperty} currentDatabaseId={db.id} />}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id}
              className="group border-b border-border opacity-0 last:border-0 hover:bg-muted/20 animate-rise"
              style={{ animationDelay: `${Math.min(i, 20) * 25}ms` }}
            >
              <td className="border-r border-border text-center align-middle">
                {!readOnly && (
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-60"
                    title="Elimina riga"
                  >
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                  </button>
                )}
              </td>
              <td className="border-r border-border">
                {readOnly ? (
                  <span className="block px-3 py-2 text-sm font-medium">{row.title || <span className="text-muted-foreground/50">Senza titolo</span>}</span>
                ) : (
                  <TextCell value={row.title} placeholder="Senza titolo" bold onCommit={(v) => patchRow(row.id, { title: v })} />
                )}
              </td>
              {db.properties.map((p) => (
                <td key={p.id} className="border-r border-border last:border-r-0 align-middle">
                  <Cell
                    property={p}
                    value={row.values?.[p.id] ?? null}
                    readOnly={readOnly}
                    onChange={(v) => patchRow(row.id, { values: { ...row.values, [p.id]: v } })}
                    onAddOption={(name) => addOption(p.id, name)}
                  />
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      {!readOnly && (
        <button
          onClick={() => addRow()}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/40"
        >
          <Plus className="h-4 w-4" /> Nuova riga
        </button>
      )}
    </div>
  );
}

function Cell({ property, value, readOnly, onChange, onAddOption }: {
  property: Property;
  value: any;
  readOnly?: boolean;
  onChange: (v: any) => void;
  onAddOption: (name: string) => string;
}) {
  if (readOnly) {
    if (property.type === "select") {
      const opt = property.options?.find((o) => o.id === value);
      return <div className="px-1.5 py-1.5"><SelectChip option={opt} /></div>;
    }
    if (property.type === "checkbox") {
      return <div className="flex justify-center py-1.5">{value ? "✓" : ""}</div>;
    }
    if (property.type === "relation") {
      return <RelationCell targetDatabaseId={property.targetDatabaseId} value={value} onChange={() => {}} readOnly />;
    }
    return <span className="block px-3 py-2 text-sm">{formatCellValue(property.type, value)}</span>;
  }
  if (property.type === "select") {
    return <SelectCell property={property} value={value} onChange={onChange} onAddOption={onAddOption} />;
  }
  if (property.type === "relation") {
    return <RelationCell targetDatabaseId={property.targetDatabaseId} value={value} onChange={onChange} />;
  }
  if (property.type === "checkbox") {
    return (
      <div className="flex items-center justify-center py-1">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      </div>
    );
  }
  if (property.type === "date") {
    return (
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full bg-transparent px-3 py-2 text-sm outline-none"
      />
    );
  }
  // text / number
  return (
    <TextCell
      value={value ?? ""}
      number={property.type === "number"}
      onCommit={(v) => onChange(property.type === "number" ? (v === "" ? null : Number(v)) : v)}
    />
  );
}

function TextCell({ value, onCommit, placeholder, bold, number }: {
  value: string | number;
  onCommit: (v: string) => void;
  placeholder?: string;
  bold?: boolean;
  number?: boolean;
}) {
  const [local, setLocal] = useState(String(value ?? ""));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setLocal(String(value ?? ""));
  }, [value]);

  return (
    <input
      type={number ? "number" : "text"}
      value={local}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { focused.current = false; if (local !== String(value ?? "")) onCommit(local); }}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      className={`w-full bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 ${bold ? "font-medium" : ""}`}
    />
  );
}

function ColumnHeader({ property, readOnly, onRename, onDelete }: { property: Property; readOnly?: boolean; onRename: (id: string, name: string) => void; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(property.name);
  const ref = useRef<HTMLTableCellElement>(null);
  const Icon = TYPE_ICON[property.type];

  useEffect(() => setName(property.name), [property.name]);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (readOnly) {
    return (
      <th className="min-w-[140px] border-r border-border px-3 py-2 font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{property.name}</span>
      </th>
    );
  }

  return (
    <th ref={ref} className="relative min-w-[140px] border-r border-border px-3 py-2 font-medium text-muted-foreground">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 hover:text-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span>{property.name}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== property.name && onRename(property.id, name.trim())}
            className="mb-1 w-full rounded border border-border bg-background px-2 py-1 text-sm font-normal text-foreground outline-none focus:border-primary"
          />
          <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">{PROPERTY_TYPE_LABEL[property.type]}</p>
          <button
            onClick={() => { onDelete(property.id); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-normal text-destructive hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" /> Elimina proprietà
          </button>
        </div>
      )}
    </th>
  );
}

interface OtherDatabase { id: string; title: string; icon: string | null }

function AddColumn({ onAdd, currentDatabaseId }: { onAdd: (type: PropertyType, extra?: Partial<Property>) => void; currentDatabaseId: string }) {
  const [open, setOpen] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [others, setOthers] = useState<OtherDatabase[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setPickingTarget(false); } }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function close() {
    setOpen(false);
    setPickingTarget(false);
  }

  function startRelation() {
    setPickingTarget(true);
    if (others === null) {
      fetch("/api/databases")
        .then((r) => r.json())
        .then((data) => setOthers((data.databases ?? []).filter((d: OtherDatabase) => d.id !== currentDatabaseId)))
        .catch(() => setOthers([]));
    }
  }

  const types: PropertyType[] = ["text", "number", "select", "date", "checkbox", "relation"];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Aggiungi colonna">
        <Plus className="h-4 w-4" />
      </button>
      {open && !pickingTarget && (
        <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          {types.map((t) => {
            const Icon = TYPE_ICON[t];
            return (
              <button
                key={t}
                onClick={() => (t === "relation" ? startRelation() : (onAdd(t), close()))}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-normal hover:bg-muted"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {PROPERTY_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      )}
      {open && pickingTarget && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          <button onClick={() => setPickingTarget(false)} className="mb-1 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted">
            <ArrowLeft className="h-3 w-3" /> Indietro
          </button>
          <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">Collega a</p>
          {others === null ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Caricamento…</p>
          ) : others.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">Nessun altro database in questo tenant.</p>
          ) : (
            others.map((o) => (
              <button
                key={o.id}
                onClick={() => { onAdd("relation", { targetDatabaseId: o.id }); close(); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span>{o.icon ?? "🗃️"}</span> <span className="truncate">{o.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
