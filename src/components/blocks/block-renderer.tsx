"use client";

import { useState } from "react";
import Link from "next/link";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";
import type { BlockType } from "@prisma/client";
import { ChevronRight, GripVertical, Plus, MoreHorizontal, Copy, Trash2, FileText } from "lucide-react";
import type { ClientBlock } from "./types";
import { InlineRichText } from "./inline-rich-text";
import { CodeBlock, DividerBlock, ImageBlock, TableSimpleBlock, VideoBlock } from "./media-blocks";
import { BLOCK_COMMANDS } from "./slash-command-menu";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

interface BlockRendererProps {
  block: ClientBlock;
  /** 1-based position among numbered-list siblings of the same run; undefined for other types. */
  numberedIndex?: number;
  editable: boolean;
  getFragment: (blockId: string) => Y.XmlFragment | null;
  provider: HocuspocusProvider | null;
  user: { name: string; color: string };
  onTextChange: (blockId: string, text: any[]) => void;
  onContentChange: (blockId: string, content: any) => void;
  onSelectBlockType: (blockId: string, type: BlockType) => void;
  onEnter: (blockId: string) => void;
  onBackspaceEmpty: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onDuplicate: (blockId: string) => void;
  onTurnInto: (blockId: string, type: BlockType) => void;
  dragHandleProps?: any;
}

/** "Trasforma in" (per-block ⋮ menu) offers only text-shaped blocks — reusing BLOCK_COMMANDS' full catalogue (icons/labels stay in one place) but leaving out media/structural types (IMAGE, VIDEO, CODE, TABLE_SIMPLE, DIVIDER) that aren't a sensible target for turning an existing block's content into. */
const TURN_INTO_TYPES: BlockType[] = [
  "PARAGRAPH", "HEADING_1", "HEADING_2", "HEADING_3",
  "BULLETED_LIST_ITEM", "NUMBERED_LIST_ITEM", "CHECKLIST_ITEM", "TOGGLE_LIST_ITEM",
  "QUOTE", "CALLOUT",
];
const TURN_INTO_ITEMS = BLOCK_COMMANDS.filter((c) => TURN_INTO_TYPES.includes(c.type));

// font-serif here (pre-Control Room) meant headings typed *inside* content
// never picked up the brand's own display face — everything around the
// editor looked redesigned, the content itself didn't.
const HEADING_CLASS: Partial<Record<BlockType, string>> = {
  HEADING_1: "font-display text-2xl font-semibold",
  HEADING_2: "font-display text-xl font-semibold",
  HEADING_3: "font-display text-lg font-semibold",
};

export function BlockRenderer(props: BlockRendererProps) {
  const { block, editable, getFragment, provider, user, onTextChange, onContentChange, onSelectBlockType, onEnter, onBackspaceEmpty, onDelete, onDuplicate, onTurnInto } = props;
  const [toggleOpen, setToggleOpen] = useState(true);

  const text = () => (
    <InlineRichText
      initialContent={block.content?.text ?? []}
      fragment={getFragment(block.id)}
      provider={provider}
      user={user}
      editable={editable}
      onTextChange={(json) => onTextChange(block.id, json)}
      onSelectBlockType={(type) => onSelectBlockType(block.id, type)}
      onEnter={() => onEnter(block.id)}
      onBackspaceEmpty={() => onBackspaceEmpty(block.id)}
    />
  );

  let body: React.ReactNode;
  switch (block.type) {
    case "PARAGRAPH":
      body = text();
      break;
    case "HEADING_1":
    case "HEADING_2":
    case "HEADING_3":
      body = <div className={HEADING_CLASS[block.type]}>{text()}</div>;
      break;
    case "QUOTE":
      body = <div className="border-l-2 border-border pl-3 italic text-muted-foreground">{text()}</div>;
      break;
    case "CALLOUT":
      body = <div className="rounded-md border border-border bg-muted/40 px-3 py-2">{text()}</div>;
      break;
    case "BULLETED_LIST_ITEM":
      body = (
        <div className="flex gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
          <div className="flex-1">{text()}</div>
        </div>
      );
      break;
    case "NUMBERED_LIST_ITEM":
      body = (
        <div className="flex gap-2">
          <span className="mt-0.5 shrink-0 text-sm tabular-nums text-muted-foreground">{(props.numberedIndex ?? 1)}.</span>
          <div className="flex-1">{text()}</div>
        </div>
      );
      break;
    case "CHECKLIST_ITEM":
      body = (
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={Boolean(block.content?.checked)}
            disabled={!editable}
            onChange={(e) => onContentChange(block.id, { ...block.content, checked: e.target.checked })}
            className="mt-1.5 shrink-0"
          />
          <div className={`flex-1 ${block.content?.checked ? "text-muted-foreground line-through" : ""}`}>{text()}</div>
        </div>
      );
      break;
    case "TOGGLE_LIST_ITEM":
      body = (
        <div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setToggleOpen((o) => !o)}
              className="mt-1 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${toggleOpen ? "rotate-90" : ""}`} />
            </button>
            <div className="flex-1">{text()}</div>
          </div>
          {toggleOpen && block.children.length > 0 && (
            <div className="ml-5 mt-1 space-y-1 border-l border-border pl-3">
              {block.children.map((child) => (
                <BlockRenderer key={child.id} {...props} block={child} />
              ))}
            </div>
          )}
        </div>
      );
      break;
    case "DIVIDER":
      body = <DividerBlock />;
      break;
    case "IMAGE":
      body = <ImageBlock content={block.content ?? {}} editable={editable} onChange={(c) => onContentChange(block.id, c)} />;
      break;
    case "VIDEO":
      body = <VideoBlock content={block.content ?? {}} editable={editable} onChange={(c) => onContentChange(block.id, c)} />;
      break;
    case "CODE":
      body = <CodeBlock content={block.content ?? {}} editable={editable} onChange={(c) => onContentChange(block.id, c)} />;
      break;
    case "TABLE_SIMPLE":
      body = <TableSimpleBlock content={block.content ?? {}} editable={editable} onChange={(c) => onContentChange(block.id, c)} />;
      break;
    case "PAGE_LINK":
      body = (
        <Link
          href={`/pages/${block.content?.pageId ?? ""}`}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">{block.content?.title || "Pagina collegata"}</span>
          {block.content?.reason && (
            <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:block max-w-[40%]">{block.content.reason}</span>
          )}
        </Link>
      );
      break;
    default:
      // COLUMN_LIST, COLUMN, EMBED, DIAGRAM, AUDIO, FILE, TABLE_OF_CONTENTS,
      // SYNCED_BLOCK_*: not yet supported by this editor pass —
      // shown as a placeholder rather than crashing, deletable so it
      // doesn't block editing the rest of the page.
      body = (
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
          Tipo di blocco non ancora supportato nell&apos;editor: {block.type}
        </div>
      );
  }

  // Nested lists under a list item (bulleted/numbered/checklist) render
  // indented beneath, same as TOGGLE_LIST_ITEM above but without a collapse
  // toggle — only reorder within a level is supported for now, not
  // cross-level drag; nested children keep their stored order as-is.
  const showChildrenInline = block.type !== "TOGGLE_LIST_ITEM" && block.children.length > 0;

  return (
    <div className="group relative flex gap-1 py-0.5">
      {editable && (
        <span
          {...props.dragHandleProps}
          className="mt-1 shrink-0 cursor-grab text-transparent group-hover:text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {body}
        {showChildrenInline && (
          <div className="ml-5 mt-1 space-y-1">
            {block.children.map((child, i) => (
              <BlockRenderer
                key={child.id}
                {...props}
                block={child}
                numberedIndex={child.type === "NUMBERED_LIST_ITEM" ? i + 1 : undefined}
              />
            ))}
          </div>
        )}
      </div>
      {editable && (
        <div className="flex shrink-0 items-start gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onSelectBlockType(block.id, "PARAGRAPH")}
            title="Aggiungi blocco sotto"
            className="mt-1 text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" title="Azioni blocco" className="mt-1 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onDuplicate(block.id)}>
                <Copy className="h-4 w-4 text-muted-foreground" /> Duplica blocco
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Trasforma in</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TURN_INTO_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.type} onClick={() => onTurnInto(block.id, item.type)}>
                        <Icon className="h-4 w-4 text-muted-foreground" /> {item.title}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(block.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4" /> Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
