"use client";

import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import {
  forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
} from "react";
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Table as TableIcon, Minus,
} from "lucide-react";

/**
 * Notion-style "/" slash command menu for the Tiptap editor. Type "/" to open
 * a filterable list of block types; arrow keys + enter to insert. Built on
 * @tiptap/suggestion so keyboard routing and query tracking are handled for us;
 * positioning uses the caret rect (no external popup lib, CSP-safe).
 */

interface CommandItem {
  title: string;
  description: string;
  aliases: string;
  icon: React.ComponentType<{ className?: string }>;
  run: (editor: any, range: any) => void;
}

const COMMANDS: CommandItem[] = [
  { title: "Testo", description: "Paragrafo semplice", aliases: "text paragraph testo", icon: Type,
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: "Titolo 1", description: "Titolo grande", aliases: "h1 titolo heading grande", icon: Heading1,
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run() },
  { title: "Titolo 2", description: "Titolo medio", aliases: "h2 titolo heading", icon: Heading2,
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run() },
  { title: "Titolo 3", description: "Sottotitolo", aliases: "h3 titolo heading sotto", icon: Heading3,
    run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run() },
  { title: "Elenco puntato", description: "Lista con punti", aliases: "bullet lista elenco punti ul", icon: List,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: "Elenco numerato", description: "Lista ordinata", aliases: "numbered numerato ordinata ol", icon: ListOrdered,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: "To-do", description: "Checklist di attività", aliases: "todo task checklist attivita", icon: CheckSquare,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: "Citazione", description: "Blocco citazione", aliases: "quote citazione blockquote", icon: Quote,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: "Codice", description: "Blocco di codice", aliases: "code codice snippet", icon: Code,
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: "Tabella", description: "Tabella 3×3", aliases: "table tabella griglia", icon: TableIcon,
    run: (e, r) => e.chain().focus().deleteRange(r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: "Divisore", description: "Linea orizzontale", aliases: "divider hr divisore linea", icon: Minus,
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
];

const SlashMenu = forwardRef(function SlashMenu(
  { items, command }: { items: CommandItem[]; command: (item: CommandItem) => void },
  ref
) {
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSelected(0), [items]);

  useLayoutEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowDown") { setSelected((s) => (s + 1) % items.length); return true; }
      if (event.key === "ArrowUp") { setSelected((s) => (s - 1 + items.length) % items.length); return true; }
      if (event.key === "Enter") { if (items[selected]) command(items[selected]); return true; }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground shadow-xl">
        Nessun blocco trovato
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="max-h-72 w-72 origin-top overflow-y-auto rounded-lg border border-border bg-card p-1.5 opacity-0 shadow-xl animate-rise"
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            data-idx={i}
            onMouseEnter={() => setSelected(i)}
            onClick={() => command(item)}
            className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left ${
              i === selected ? "bg-primary/10" : "hover:bg-muted"
            }`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border ${i === selected ? "text-primary" : "text-muted-foreground"}`}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

export const SlashCommand = Extension.create({
  name: "slashCommand",
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }: any) => props.run(editor, range),
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          return COMMANDS.filter((c) => (c.title + " " + c.aliases).toLowerCase().includes(q));
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let el: HTMLDivElement | null = null;

          const position = (rect: DOMRect | null) => {
            if (!el || !rect) return;
            el.style.position = "fixed";
            el.style.left = `${rect.left}px`;
            el.style.top = `${rect.bottom + 6}px`;
            el.style.zIndex = "200";
          };

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashMenu, {
                props: { items: props.items, command: (item: CommandItem) => props.command(item) },
                editor: props.editor,
              });
              el = document.createElement("div");
              el.appendChild(component.element);
              document.body.appendChild(el);
              position(props.clientRect?.());
            },
            onUpdate: (props: any) => {
              component?.updateProps({ items: props.items, command: (item: CommandItem) => props.command(item) });
              position(props.clientRect?.());
            },
            onKeyDown: (props: any) => {
              if (props.event.key === "Escape") {
                el?.remove();
                el = null;
                return true;
              }
              return (component?.ref as any)?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              el?.remove();
              el = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
