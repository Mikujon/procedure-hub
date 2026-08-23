"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Table2, Kanban, LayoutGrid, CalendarDays, Plus, Trash2, Loader2, Check, Lock } from "lucide-react";
import { EmojiPicker } from "@/components/pages/emoji-picker";
import { TableView } from "./table-view";
import { BoardView } from "./board-view";
import { GalleryView } from "./gallery-view";
import { CalendarView } from "./calendar-view";
import { SELECT_COLORS, uid, type Database, type Property, type PropertyType, type Row, type View } from "./types";
import { newPropertyClient } from "./helpers";

const VIEW_TYPE_ICON: Record<View["type"], React.ComponentType<{ className?: string }>> = {
  table: Table2,
  board: Kanban,
  gallery: LayoutGrid,
  calendar: CalendarDays,
};

const VIEW_TYPE_LABEL: Record<View["type"], string> = {
  table: "Tabella",
  board: "Bacheca",
  gallery: "Galleria",
  calendar: "Calendario",
};

export function DatabaseApp({ id }: { id: string }) {
  const router = useRouter();
  const [db, setDb] = useState<Database | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("");
  const [showPicker, setShowPicker] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [saved, setSaved] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/databases/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (!active) return;
        const d = data.database as Database;
        setDb(d);
        setRows(d.rows ?? []);
        setActiveViewId(d.views[0]?.id ?? "");
        setCanEdit(data.canEdit !== false);
      })
      .catch(() => active && setNotFound(true));
    return () => { active = false; };
  }, [id]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }, []);

  const persistDb = useCallback(
    (patch: Partial<Pick<Database, "title" | "icon" | "properties" | "views">>) => {
      fetch(`/api/databases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(flashSaved);
    },
    [id, flashSaved]
  );

  // ---- schema ops ----
  const setProperties = useCallback(
    (properties: Property[]) => {
      setDb((d) => (d ? { ...d, properties } : d));
      persistDb({ properties });
    },
    [persistDb]
  );

  const addProperty = useCallback(
    (type: PropertyType, extra?: Partial<Property>) => {
      setDb((d) => {
        if (!d) return d;
        const properties = [...d.properties, { ...newPropertyClient(type, defaultName(type, d.properties.length)), ...extra }];
        persistDb({ properties });
        return { ...d, properties };
      });
    },
    [persistDb]
  );

  const renameProperty = useCallback(
    (propId: string, name: string) => {
      setDb((d) => {
        if (!d) return d;
        const properties = d.properties.map((p) => (p.id === propId ? { ...p, name } : p));
        persistDb({ properties });
        return { ...d, properties };
      });
    },
    [persistDb]
  );

  const deleteProperty = useCallback(
    (propId: string) => {
      setDb((d) => {
        if (!d) return d;
        const properties = d.properties.filter((p) => p.id !== propId);
        const views = d.views.map((v) =>
          v.groupByPropertyId === propId ? { ...v, groupByPropertyId: undefined } : v
        );
        persistDb({ properties, views });
        return { ...d, properties, views };
      });
    },
    [persistDb]
  );

  // Add a select option and return its id synchronously (persist async).
  const addOption = useCallback(
    (propId: string, name: string) => {
      const id2 = uid();
      setDb((d) => {
        if (!d) return d;
        const properties = d.properties.map((p) => {
          if (p.id !== propId) return p;
          const opts = p.options ?? [];
          return { ...p, options: [...opts, { id: id2, name, color: SELECT_COLORS[opts.length % SELECT_COLORS.length] }] };
        });
        persistDb({ properties });
        return { ...d, properties };
      });
      return id2;
    },
    [persistDb]
  );

  // ---- row ops ----
  const patchRow = useCallback(
    (rowId: string, patch: { title?: string; values?: Record<string, any> }) => {
      setRows((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
      fetch(`/api/databases/${id}/rows/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then(flashSaved);
    },
    [id, flashSaved]
  );

  const addRow = useCallback(
    async (values: Record<string, any> = {}, title = "") => {
      const res = await fetch(`/api/databases/${id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, title }),
      });
      const { row } = await res.json();
      setRows((rs) => [...rs, row]);
    },
    [id]
  );

  const deleteRow = useCallback(
    (rowId: string) => {
      setRows((rs) => rs.filter((r) => r.id !== rowId));
      fetch(`/api/databases/${id}/rows/${rowId}`, { method: "DELETE" });
    },
    [id]
  );

  const setGroupBy = useCallback(
    (viewId: string, propId: string) => {
      setDb((d) => {
        if (!d) return d;
        const views = d.views.map((v) => (v.id === viewId ? { ...v, groupByPropertyId: propId } : v));
        persistDb({ views });
        return { ...d, views };
      });
    },
    [persistDb]
  );

  const setViewConfig = useCallback(
    (viewId: string, config: View["config"]) => {
      setDb((d) => {
        if (!d) return d;
        const views = d.views.map((v) => (v.id === viewId ? { ...v, config: { ...v.config, ...config } } : v));
        persistDb({ views });
        return { ...d, views };
      });
    },
    [persistDb]
  );

  const addView = useCallback(
    (type: View["type"]) => {
      const newView: View = { id: uid(), name: VIEW_TYPE_LABEL[type], type };
      setDb((d) => {
        if (!d) return d;
        const views = [...d.views, newView];
        persistDb({ views });
        return { ...d, views };
      });
      setActiveViewId(newView.id);
    },
    [persistDb]
  );

  async function removeDatabase() {
    if (!confirm("Eliminare questo database e tutte le righe?")) return;
    await fetch(`/api/databases/${id}`, { method: "DELETE" });
    router.push("/dashboard");
    router.refresh();
  }

  if (notFound) return <p className="mx-auto max-w-5xl text-sm text-muted-foreground">Database non trovato.</p>;
  if (!db) return <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const activeView = db.views.find((v) => v.id === activeViewId) ?? db.views[0];

  const handlers = { patchRow, addRow, deleteRow, addProperty, renameProperty, deleteProperty, addOption };

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => canEdit && setShowPicker((s) => !s)}
            className={`flex h-10 w-10 items-center justify-center rounded-md text-3xl ${canEdit ? "hover:bg-muted" : "cursor-default"}`}
          >
            {db.icon ?? "🗃️"}
          </button>
          {showPicker && canEdit && (
            <EmojiPicker
              current={db.icon}
              onSelect={(e) => { setDb((d) => (d ? { ...d, icon: e } : d)); persistDb({ icon: e }); setShowPicker(false); }}
              onClose={() => setShowPicker(false)}
            />
          )}
          {canEdit ? (
            <input
              value={db.title}
              onChange={(e) => { setDb((d) => (d ? { ...d, title: e.target.value } : d)); persistDb({ title: e.target.value || "Senza titolo" }); }}
              className="bg-transparent font-display text-3xl font-bold tracking-tight outline-none"
            />
          ) : (
            <h1 className="font-display text-3xl font-bold tracking-tight">{db.title}</h1>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {canEdit ? (
            <>
              {saved && <span className="flex items-center gap-1"><Check className="h-3 w-3 text-stamp-green" /> Salvato</span>}
              <button onClick={removeDatabase} className="hover:text-destructive" title="Elimina database"><Trash2 className="h-4 w-4" /></button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
              <Lock className="h-3 w-3" /> Sola lettura
            </span>
          )}
        </div>
      </div>

      {/* view tabs */}
      <div className="mb-3 flex items-center gap-1 border-b border-border">
        {db.views.map((v) => {
          const Icon = VIEW_TYPE_ICON[v.type];
          return (
            <button
              key={v.id}
              onClick={() => setActiveViewId(v.id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${
                v.id === activeView.id ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {v.name}
            </button>
          );
        })}
        {canEdit && <AddViewMenu onAdd={addView} />}
      </div>

      {activeView.type === "table" && <TableView db={db} rows={rows} readOnly={!canEdit} {...handlers} />}
      {activeView.type === "board" && (
        <BoardView db={db} rows={rows} view={activeView} readOnly={!canEdit} onSetGroupBy={(pid) => setGroupBy(activeView.id, pid)} {...handlers} />
      )}
      {activeView.type === "gallery" && <GalleryView db={db} rows={rows} readOnly={!canEdit} {...handlers} />}
      {activeView.type === "calendar" && (
        <CalendarView db={db} rows={rows} view={activeView} readOnly={!canEdit} onSetDateColumn={(pid) => setViewConfig(activeView.id, { dateColumnId: pid })} {...handlers} />
      )}
    </div>
  );
}

function defaultName(type: PropertyType, index: number) {
  const base: Record<PropertyType, string> = { text: "Testo", number: "Numero", select: "Selezione", date: "Data", checkbox: "Casella", relation: "Relazione" };
  return `${base[type]} ${index + 1}`;
}

const ADDABLE_VIEW_TYPES: View["type"][] = ["table", "board", "gallery", "calendar"];

function AddViewMenu({ onAdd }: { onAdd: (type: View["type"]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative ml-1 mb-1">
      <button onClick={() => setOpen((o) => !o)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground" title="Aggiungi vista">
        <Plus className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          {ADDABLE_VIEW_TYPES.map((t) => {
            const Icon = VIEW_TYPE_ICON[t];
            return (
              <button
                key={t}
                onClick={() => { onAdd(t); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-normal hover:bg-muted"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {VIEW_TYPE_LABEL[t]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
