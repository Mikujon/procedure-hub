"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Info,
  ListChecks,
  ListOrdered,
  Quote,
  Code2,
  Minus,
  BookText,
  ChevronDown,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Block } from "@/lib/types";

// ---- block type registry --------------------------------------------------
type InsertType = Block["type"];
const BLOCK_TYPES: { type: InsertType; label: string; icon: LucideIcon; desc: string }[] = [
  { type: "heading", label: "Heading", icon: Heading1, desc: "Section title" },
  { type: "paragraph", label: "Text", icon: Pilcrow, desc: "Plain paragraph" },
  { type: "callout", label: "Callout", icon: Info, desc: "Highlighted note" },
  { type: "checklist", label: "Checklist", icon: ListChecks, desc: "Tickable items" },
  { type: "steps", label: "Steps", icon: ListOrdered, desc: "Numbered sequence" },
  { type: "quote", label: "Quote", icon: Quote, desc: "Block quotation" },
  { type: "table", label: "Table", icon: TableIcon, desc: "Rows and columns" },
  { type: "code", label: "Code", icon: Code2, desc: "Monospaced block" },
  { type: "definition", label: "Definition", icon: BookText, desc: "Term + definition" },
  { type: "divider", label: "Divider", icon: Minus, desc: "Visual break" },
];

function newBlock(type: InsertType): Block {
  switch (type) {
    case "heading": return { type: "heading", level: 2, text: "" };
    case "paragraph": return { type: "paragraph", text: "" };
    case "callout": return { type: "callout", variant: "info", text: "", title: "" };
    case "checklist": return { type: "checklist", items: [{ text: "", checked: false }] };
    case "steps": return { type: "steps", items: [""] };
    case "quote": return { type: "quote", text: "", cite: "" };
    case "code": return { type: "code", language: "text", text: "" };
    case "table": return { type: "table", headers: ["", ""], rows: [["", ""]] };
    case "divider": return { type: "divider" };
    case "definition": return { type: "definition", term: "", definition: "" };
  }
}

// ---- main editor ----------------------------------------------------------
export function BlockEditor({
  value,
  onChange,
}: {
  value: Block[];
  onChange: (blocks: Block[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const update = (i: number, patch: Partial<Block>) => {
    onChange(value.map((b, idx) => (idx === i ? ({ ...b, ...patch } as Block) : b)));
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const insert = (i: number, type: InsertType) => {
    const next = [...value];
    next.splice(i, 0, newBlock(type));
    onChange(next);
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    onChange(arrayMove(value, from, to));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    if (Number.isNaN(from) || Number.isNaN(to)) return;
    onChange(arrayMove(value, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={value.map((_, i) => i)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1.5">
          {value.map((block, i) => (
            <SortableBlock
              key={i}
              id={i}
              block={block}
              onUpdate={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
              onInsertAfter={(type) => insert(i + 1, type)}
              onMoveUp={() => move(i, i - 1)}
              onMoveDown={() => move(i, i + 1)}
              isFirst={i === 0}
              isLast={i === value.length - 1}
            />
          ))}
        </div>
      </SortableContext>

      <div className="pt-3">
        <InsertButton onInsert={(type) => insert(value.length, type)} />
      </div>
    </DndContext>
  );
}

// ---- a single sortable block row -----------------------------------------
function SortableBlock({
  id,
  block,
  onUpdate,
  onRemove,
  onInsertAfter,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  id: number;
  block: Block;
  onUpdate: (patch: Partial<Block>) => void;
  onRemove: () => void;
  onInsertAfter: (type: InsertType) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-1.5 rounded-lg",
        isDragging && "shadow-[var(--shadow-lift)] bg-card opacity-95"
      )}
    >
      {/* row controls */}
      <div className="flex shrink-0 flex-col items-center gap-0.5 pt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          {...attributes}
          {...listeners}
          className="flex h-6 w-5 cursor-grab items-center justify-center text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <InsertMenu onInsert={onInsertAfter} compact />
      </div>

      {/* the block editor */}
      <div className="min-w-0 flex-1 py-1">
        <BlockFields block={block} onUpdate={onUpdate} />
      </div>

      {/* remove + move */}
      <div className="flex shrink-0 flex-col gap-0.5 pt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="flex h-5 w-5 items-center justify-center text-muted-foreground/60 hover:text-foreground disabled:opacity-20"
          aria-label="Move up"
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="flex h-5 w-5 items-center justify-center text-muted-foreground/60 hover:text-foreground disabled:opacity-20"
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="flex h-5 w-5 items-center justify-center text-muted-foreground/60 hover:text-destructive"
          aria-label="Delete block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---- per-type fields ------------------------------------------------------
function BlockFields({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border bg-card p-0.5">
            {[1, 2, 3].map((lvl) => (
              <button
                key={lvl}
                onClick={() => onUpdate({ level: lvl as 1 | 2 | 3 })}
                className={cn(
                  "flex h-6 w-7 items-center justify-center rounded text-xs font-semibold transition-colors",
                  block.level === lvl
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                H{lvl}
              </button>
            ))}
          </div>
          <input
            value={block.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Heading text…"
            className="font-display flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xl font-medium tracking-tight focus:border-border focus:bg-card focus:outline-none"
          />
        </div>
      );

    case "paragraph":
      return (
        <AutoTextarea
          value={block.text}
          onChange={(v) => onUpdate({ text: v })}
          placeholder="Write something…"
          className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-[15px] leading-relaxed focus:border-border focus:bg-card focus:outline-none"
        />
      );

    case "callout":
      return (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={block.variant}
              onChange={(e) => onUpdate({ variant: e.target.value as any })}
              className="h-7 rounded-md border border-border bg-card px-2 text-xs"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="danger">Danger</option>
            </select>
            <input
              value={block.title ?? ""}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Title (optional)"
              className="h-7 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium focus:border-border focus:bg-card focus:outline-none"
            />
          </div>
          <AutoTextarea
            value={block.text}
            onChange={(v) => onUpdate({ text: v })}
            placeholder="Callout text…"
            className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-relaxed focus:border-border focus:bg-card focus:outline-none"
          />
        </div>
      );

    case "checklist":
      return (
        <div className="space-y-1">
          {block.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                onClick={() =>
                  onUpdate({
                    items: block.items.map((it, i) =>
                      i === idx ? { ...it, checked: !it.checked } : it
                    ),
                  })
                }
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                  item.checked
                    ? "border-status-published bg-status-published text-white"
                    : "border-border bg-background"
                )}
              >
                {item.checked && "✓"}
              </button>
              <input
                value={item.text}
                onChange={(e) =>
                  onUpdate({
                    items: block.items.map((it, i) =>
                      i === idx ? { ...it, text: e.target.value } : it
                    ),
                  })
                }
                placeholder="Checklist item…"
                className={cn(
                  "flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[15px] focus:border-border focus:bg-card focus:outline-none",
                  item.checked && "text-muted-foreground line-through"
                )}
              />
              <button
                onClick={() =>
                  onUpdate({ items: block.items.filter((_, i) => i !== idx) })
                }
                className="text-muted-foreground/40 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onUpdate({ items: [...block.items, { text: "", checked: false }] })
            }
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add item
          </button>
        </div>
      );

    case "steps":
      return (
        <div className="space-y-1">
          {block.items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {idx + 1}
              </span>
              <input
                value={item}
                onChange={(e) =>
                  onUpdate({
                    items: block.items.map((it, i) =>
                      i === idx ? e.target.value : it
                    ),
                  })
                }
                placeholder="Step…"
                className="flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[15px] focus:border-border focus:bg-card focus:outline-none"
              />
              <button
                onClick={() =>
                  onUpdate({ items: block.items.filter((_, i) => i !== idx) })
                }
                className="text-muted-foreground/40 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ items: [...block.items, ""] })}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add step
          </button>
        </div>
      );

    case "quote":
      return (
        <div className="border-l-2 border-primary/40 pl-3 space-y-1.5">
          <AutoTextarea
            value={block.text}
            onChange={(v) => onUpdate({ text: v })}
            placeholder="Quote…"
            className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-lg italic focus:border-border focus:bg-card focus:outline-none"
          />
          <input
            value={block.cite ?? ""}
            onChange={(e) => onUpdate({ cite: e.target.value })}
            placeholder="Source (optional)"
            className="h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-xs text-muted-foreground focus:border-border focus:bg-card focus:outline-none"
          />
        </div>
      );

    case "code":
      return (
        <div className="rounded-lg border border-border bg-muted/40 p-2 space-y-1.5">
          <input
            value={block.language}
            onChange={(e) => onUpdate({ language: e.target.value })}
            placeholder="language"
            className="h-6 w-32 rounded border border-border bg-card px-2 font-mono text-[11px] focus:outline-none"
          />
          <AutoTextarea
            value={block.text}
            onChange={(v) => onUpdate({ text: v })}
            placeholder="// code…"
            className="w-full resize-none rounded border border-transparent bg-transparent px-2 py-1 font-mono text-[13px] leading-relaxed focus:border-border focus:bg-card focus:outline-none"
          />
        </div>
      );

    case "table":
      return <TableEditor block={block} onUpdate={onUpdate} />;

    case "divider":
      return (
        <div className="flex items-center gap-2 py-2 text-muted-foreground/40">
          <Minus className="h-4 w-4" />
          <span className="h-px flex-1 bg-border" />
        </div>
      );

    case "definition":
      return (
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
          <input
            value={block.term}
            onChange={(e) => onUpdate({ term: e.target.value })}
            placeholder="Term"
            className="h-7 w-full rounded-md border border-transparent bg-transparent px-2 text-xs font-semibold uppercase tracking-wide focus:border-border focus:bg-card focus:outline-none"
          />
          <AutoTextarea
            value={block.definition}
            onChange={(v) => onUpdate({ definition: v })}
            placeholder="Definition…"
            className="w-full resize-none rounded-md border border-transparent bg-transparent px-2 py-1 text-[15px] focus:border-border focus:bg-card focus:outline-none"
          />
        </div>
      );

    default:
      return null;
  }
}

function TableEditor({
  block,
  onUpdate,
}: {
  block: Extract<Block, { type: "table" }>;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const setHeader = (i: number, v: string) =>
    onUpdate({ headers: block.headers.map((h, idx) => (idx === i ? v : h)) });
  const setCell = (r: number, c: number, v: string) =>
    onUpdate({
      rows: block.rows.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row
      ),
    });
  const addRow = () => onUpdate({ rows: [...block.rows, block.headers.map(() => "")] });
  const addCol = () =>
    onUpdate({
      headers: [...block.headers, ""],
      rows: block.rows.map((r) => [...r, ""]),
    });

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/40">
            {block.headers.map((h, i) => (
              <th key={i} className="border-b border-border p-0">
                <input
                  value={h}
                  onChange={(e) => setHeader(i, e.target.value)}
                  placeholder="Header"
                  className="w-full bg-transparent px-2 py-1.5 text-left font-semibold focus:outline-none focus:bg-card"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/60 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className="p-0">
                  <input
                    value={cell}
                    onChange={(e) => setCell(ri, ci, e.target.value)}
                    placeholder="…"
                    className="w-full bg-transparent px-2 py-1.5 focus:outline-none focus:bg-card"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 border-t border-border bg-muted/20 p-1.5">
        <button onClick={addRow} className="inline-flex items-center gap-1 rounded text-[11px] text-muted-foreground hover:text-foreground">
          <Plus className="h-3 w-3" /> Row
        </button>
        <button onClick={addCol} className="inline-flex items-center gap-1 rounded text-[11px] text-muted-foreground hover:text-foreground">
          <Plus className="h-3 w-3" /> Column
        </button>
      </div>
    </div>
  );
}

// ---- auto-growing textarea ------------------------------------------------
const AutoTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value?: string }
>(function AutoTextarea({ value, onChange, className, ...rest }, ref) {
  const inner = React.useRef<HTMLTextAreaElement | null>(null);
  React.useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as any).current = node;
      }}
      value={value}
      onChange={onChange}
      className={className}
      rows={1}
      {...rest}
    />
  );
});

// ---- insert menu ----------------------------------------------------------
function InsertMenu({
  onInsert,
  compact = false,
}: {
  onInsert: (type: InsertType) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className={cn(
          "flex items-center justify-center text-muted-foreground/60 hover:text-primary",
          compact ? "h-5 w-5" : "h-8 gap-1.5 rounded-lg border border-border bg-card px-3 text-sm"
        )}
        aria-label="Add block"
      >
        <Plus className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {!compact && <span>Block</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-border bg-popover p-1 shadow-[var(--shadow-lift)]">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.type}
              onMouseDown={(e) => {
                e.preventDefault();
                onInsert(t.type);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
            >
              <t.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">
                <span className="block font-medium">{t.label}</span>
                <span className="block text-[11px] text-muted-foreground">{t.desc}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InsertButton({ onInsert }: { onInsert: (type: InsertType) => void }) {
  return (
    <div className="flex items-center gap-2">
      <InsertMenu onInsert={onInsert} />
      <span className="text-xs text-muted-foreground">Add a block, or drag rows to reorder</span>
    </div>
  );
}
