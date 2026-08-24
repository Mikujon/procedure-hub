"use client";

import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { BlockType } from "@prisma/client";
import {
  Type, Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  ChevronRight, Quote, Megaphone, Code, Table as TableIcon, Minus, Image as ImageIcon, Video,
  ListTree, Globe, Workflow, Columns2,
} from "lucide-react";

/**
 * Same "/" insertion pattern as src/components/editor/slash-command.tsx
 * (built on @tiptap/suggestion, manual ReactRenderer DOM-mount positioned
 * off the caret rect, forwardRef/useImperativeHandle keyboard routing) —
 * but each block here is its own tiny Tiptap instance with a restricted
 * schema, so selecting a command doesn't run a ProseMirror chain command;
 * it clears the "/" trigger and hands the chosen BlockType up to the block
 * editor, which creates the actual new Block via the API.
 */

interface CommandItem {
  title: string;
  description: string;
  aliases: string;
  icon: React.ComponentType<{ className?: string }>;
  type: BlockType;
}

export const BLOCK_COMMANDS: CommandItem[] = [
  { title: "Testo", description: "Paragrafo semplice", aliases: "text paragraph testo", icon: Type, type: "PARAGRAPH" },
  { title: "Titolo 1", description: "Titolo grande", aliases: "h1 titolo heading grande", icon: Heading1, type: "HEADING_1" },
  { title: "Titolo 2", description: "Titolo medio", aliases: "h2 titolo heading", icon: Heading2, type: "HEADING_2" },
  { title: "Titolo 3", description: "Sottotitolo", aliases: "h3 titolo heading sotto", icon: Heading3, type: "HEADING_3" },
  { title: "Elenco puntato", description: "Lista con punti", aliases: "bullet lista elenco punti ul", icon: List, type: "BULLETED_LIST_ITEM" },
  { title: "Elenco numerato", description: "Lista ordinata", aliases: "numbered numerato ordinata ol", icon: ListOrdered, type: "NUMBERED_LIST_ITEM" },
  { title: "To-do", description: "Checklist di attività", aliases: "todo task checklist attivita", icon: CheckSquare, type: "CHECKLIST_ITEM" },
  { title: "Toggle", description: "Elenco a scomparsa", aliases: "toggle scomparsa collassabile", icon: ChevronRight, type: "TOGGLE_LIST_ITEM" },
  { title: "Citazione", description: "Blocco citazione", aliases: "quote citazione blockquote", icon: Quote, type: "QUOTE" },
  // Was missing from this list entirely — BlockRenderer has rendered
  // CALLOUT since Fase 1, but nothing let you ever insert one. Turn-into
  // (block-renderer.tsx) reuses this same list, so it gets the fix too.
  { title: "Callout", description: "Blocco in evidenza", aliases: "callout nota avviso evidenza", icon: Megaphone, type: "CALLOUT" },
  { title: "Codice", description: "Blocco di codice", aliases: "code codice snippet", icon: Code, type: "CODE" },
  { title: "Tabella", description: "Tabella semplice", aliases: "table tabella griglia", icon: TableIcon, type: "TABLE_SIMPLE" },
  { title: "Divisore", description: "Linea orizzontale", aliases: "divider hr divisore linea", icon: Minus, type: "DIVIDER" },
  { title: "Immagine", description: "Immagine da URL", aliases: "image immagine foto", icon: ImageIcon, type: "IMAGE" },
  { title: "Video", description: "Video YouTube", aliases: "video youtube", icon: Video, type: "VIDEO" },
  // Renders a live, always-current list of the document's own H1/H2/H3 —
  // computed by BlockEditor from its own sibling blocks (block-editor.tsx),
  // not stored content of its own. At publish time it becomes a real list
  // of anchor links (lib/blocks/serialize.ts + lib/toc.ts), same ids the
  // floating reading outline on the procedure page uses.
  { title: "Indice", description: "Elenco dei titoli del documento", aliases: "toc indice sommario table of contents", icon: ListTree, type: "TABLE_OF_CONTENTS" },
  { title: "Incorpora", description: "Contenuto esterno (Figma, Google Docs, Loom, …)", aliases: "embed incorpora iframe figma loom", icon: Globe, type: "EMBED" },
  { title: "Diagramma", description: "Flowchart Mermaid", aliases: "diagram diagramma mermaid flowchart schema", icon: Workflow, type: "DIAGRAM" },
  { title: "Colonne", description: "Layout affiancato a 2 colonne", aliases: "colonne columns layout affiancato", icon: Columns2, type: "COLUMN_LIST" },
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

export const SlashCommandMenu = Extension.create<{ onSelectType: (type: BlockType) => void }>({
  name: "blockSlashCommand",
  addOptions() {
    return { onSelectType: () => {} };
  },
  addProseMirrorPlugins() {
    const { onSelectType } = this.options;
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          editor.chain().focus().deleteRange(range).run();
          onSelectType((props as CommandItem).type);
        },
        items: ({ query }: { query: string }) => {
          const q = query.toLowerCase();
          return BLOCK_COMMANDS.filter((c) => (c.title + " " + c.aliases).toLowerCase().includes(q));
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
