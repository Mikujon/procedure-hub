"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus, Check } from "lucide-react";
import type { Property } from "./types";

export function SelectChip({ option }: { option?: { name: string; color: string } }) {
  if (!option) return <span className="text-sm text-muted-foreground/50">—</span>;
  return (
    <span
      className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium text-foreground/80"
      style={{ backgroundColor: option.color }}
    >
      {option.name}
    </span>
  );
}

/** A select cell: shows the chosen option chip; click to open a dropdown to
 *  pick, clear, or add a new option. */
export function SelectCell({
  property,
  value,
  onChange,
  onAddOption,
  align = "left",
}: {
  property: Property;
  value: string | null;
  onChange: (optionId: string | null) => void;
  onAddOption: (name: string) => string; // returns new option id
  align?: "left" | "center";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const options = property.options ?? [];
  const current = options.find((o) => o.id === value);

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

  const filtered = options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));
  const canCreate = q.trim() && !options.some((o) => o.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-7 w-full items-center ${align === "center" ? "justify-center" : ""} rounded px-1.5 py-1 hover:bg-muted`}
      >
        <SelectChip option={current} />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1.5 shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cerca o crea…"
            className="mb-1.5 w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
          />
          <div className="max-h-52 overflow-y-auto">
            {value && (
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Rimuovi
              </button>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); setQ(""); }}
                className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left hover:bg-muted"
              >
                <SelectChip option={o} />
                {o.id === value && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
            {canCreate && (
              <button
                onClick={() => {
                  const id = onAddOption(q.trim());
                  onChange(id);
                  setOpen(false);
                  setQ("");
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <Plus className="h-3.5 w-3.5" /> Crea <span className="font-medium">“{q.trim()}”</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
