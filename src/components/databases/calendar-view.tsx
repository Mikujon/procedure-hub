"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database, Row, View } from "./types";

interface Handlers {
  addRow: (values?: Record<string, any>, title?: string) => void;
  deleteRow: (rowId: string) => void;
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MONTH_LABELS = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function monthGridDays(cursor: Date): Date[] {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = startOfWeekMonday(firstOfMonth);
  const end = addDays(startOfWeekMonday(lastOfMonth), 6);
  const days: Date[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) days.push(cur);
  return days;
}

/**
 * Month/week grid, one date property (view.config.dateColumnId) positions
 * rows on it. Dates are compared as the same "YYYY-MM-DD" strings the DATE
 * property already stores (native <input type="date"> values in TableView)
 * — deliberately not parsed through Date/toISOString for the comparison
 * itself, which would shift by a day for any timezone ahead of UTC.
 */
export function CalendarView({ db, rows, view, readOnly = false, onSetDateColumn, addRow, deleteRow }: {
  db: Database;
  rows: Row[];
  view: View;
  readOnly?: boolean;
  onSetDateColumn: (propId: string) => void;
} & Handlers) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());

  const dateProps = db.properties.filter((p) => p.type === "date");
  const dateProp = dateProps.find((p) => p.id === view.config?.dateColumnId);

  // Hooks called unconditionally, before the no-dateProp early return below
  // — a hook after a conditional return would run on some renders and not
  // others (e.g. right after onSetDateColumn resolves) and violate the
  // rules of hooks.
  const days = useMemo(
    () => (mode === "month" ? monthGridDays(cursor) : Array.from({ length: 7 }, (_, i) => addDays(startOfWeekMonday(cursor), i))),
    [mode, cursor]
  );
  const rowsByDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    if (!dateProp) return map;
    for (const row of rows) {
      const iso = row.values?.[dateProp.id];
      if (!iso) continue;
      const bucket = map.get(iso);
      if (bucket) bucket.push(row);
      else map.set(iso, [row]);
    }
    return map;
  }, [rows, dateProp]);

  if (!dateProp) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="mb-3 text-sm text-muted-foreground">
          Il calendario ha bisogno di una proprietà di tipo <strong>Data</strong> come riferimento.
        </p>
        {dateProps.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            {dateProps.map((p) => (
              <button key={p.id} onClick={() => onSetDateColumn(p.id)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                Usa “{p.name}” come riferimento
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aggiungi prima una colonna di tipo Data nella vista Tabella.</p>
        )}
      </div>
    );
  }

  const currentMonth = cursor.getMonth();
  const todayISO = toISODate(new Date());

  function step(delta: number) {
    setCursor((c) => (mode === "month" ? new Date(c.getFullYear(), c.getMonth() + delta, 1) : addDays(c, delta * 7)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button onClick={() => step(-1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Precedente">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="min-w-[10rem] text-center text-sm font-medium">
            {mode === "month" ? `${MONTH_LABELS[currentMonth]} ${cursor.getFullYear()}` : `Settimana del ${toISODate(startOfWeekMonday(cursor)).split("-").reverse().join("/")}`}
          </h3>
          <button onClick={() => step(1)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="Successivo">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setCursor(new Date())} className="ml-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">
            Oggi
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex rounded-md border border-border p-0.5">
            {(["month", "week"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn("rounded px-2 py-1", mode === m ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {m === "month" ? "Mese" : "Settimana"}
              </button>
            ))}
          </div>
          {dateProps.length > 1 && (
            <select
              value={dateProp.id}
              onChange={(e) => onSetDateColumn(e.target.value)}
              className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground outline-none"
            >
              {dateProps.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted/40 px-2 py-1.5 text-center font-medium text-muted-foreground">{label}</div>
        ))}
        {days.map((day) => {
          const iso = toISODate(day);
          const dayRows = rowsByDate.get(iso) ?? [];
          const inMonth = mode === "week" || day.getMonth() === currentMonth;
          const isToday = iso === todayISO;
          return (
            <div key={iso} className={cn("group min-h-[6.5rem] bg-card p-1.5", !inMonth && "bg-muted/20")}>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                    isToday ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {day.getDate()}
                </span>
                {!readOnly && (
                  <button
                    onClick={() => addRow({ [dateProp.id]: iso }, "")}
                    className="text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 hover:opacity-100"
                    title="Aggiungi in questa data"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {dayRows.map((row) => (
                  <div key={row.id} className="group flex items-center justify-between gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-foreground/90">
                    <span className="truncate">{row.title || "Senza titolo"}</span>
                    {!readOnly && (
                      <button onClick={() => deleteRow(row.id)} className="shrink-0 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-60">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
