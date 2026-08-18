"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BlockType } from "@prisma/client";
import { Plus } from "lucide-react";
import { useCollaborativeEditor } from "@/hooks/use-collaborative-editor";
import { BlockRenderer } from "./block-renderer";
import type { ClientBlock } from "./types";

type FlatBlock = Omit<ClientBlock, "children">;

/**
 * Where new blocks get POSTed, and (procedures only, Fase 1) where
 * real-time collaboration connects. Pages don't get live collaboration in
 * Fase 2b — the collab-token is scoped to procedureId server-side; wiring
 * a page-scoped token is a natural extension, not needed to close this phase.
 */
type BlockParent = { type: "procedure"; id: string } | { type: "page"; id: string };

interface BlockEditorProps {
  parent: BlockParent;
  /** Tree shape, as returned by GET /api/procedures/[id]/blocks or GET /api/pages/[id]/blocks. */
  initialBlocks: ClientBlock[];
  editable: boolean;
  /** Null when the parent is a Page (no collab yet) or the collab-token fetch failed — editor still works, just without live cross-session merge. */
  collabToken: string | null;
  user: { name: string; color: string };
}

function flattenTree(tree: ClientBlock[]): FlatBlock[] {
  const out: FlatBlock[] = [];
  const walk = (nodes: ClientBlock[]) => {
    for (const n of nodes) {
      const { children, ...rest } = n;
      out.push(rest);
      walk(children);
    }
  };
  walk(tree);
  return out;
}

function buildClientTree(flat: FlatBlock[]): ClientBlock[] {
  const byId = new Map<string, ClientBlock>();
  flat.forEach((b) => byId.set(b.id, { ...b, children: [] }));
  const roots: ClientBlock[] = [];
  byId.forEach((b) => {
    const parent = b.parentBlockId ? byId.get(b.parentBlockId) : undefined;
    if (parent) parent.children.push(b);
    else roots.push(b);
  });
  const sortRec = (nodes: ClientBlock[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function defaultContentFor(type: BlockType): any {
  switch (type) {
    case "CHECKLIST_ITEM":
      return { text: [], checked: false };
    case "CODE":
      return { code: "", language: null };
    case "IMAGE":
      return { url: "", caption: "" };
    case "VIDEO":
      return { url: "" };
    case "TABLE_SIMPLE":
      return { rows: [["", ""], ["", ""]] };
    case "DIVIDER":
      return {};
    default:
      return { text: [] };
  }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Wraps a callback in a permanently-stable function identity (ref.current
 * always points at the latest render's real implementation). Needed because
 * InlineRichText's useEditor only refreshes editorProps.handleKeyDown (and
 * similar non-whitelisted options) when its `deps` array changes — passing
 * these raw would silently call a stale closure over old block state after
 * the first render.
 */
function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback(((...args: any[]) => ref.current(...args)) as T, []);
}

function SortableItem({
  block,
  ...rest
}: { block: ClientBlock } & Omit<React.ComponentProps<typeof BlockRenderer>, "block" | "dragHandleProps">) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <BlockRenderer block={block} dragHandleProps={{ ...attributes, ...listeners }} {...rest} />
    </div>
  );
}

export function BlockEditor({ parent, initialBlocks, editable, collabToken, user }: BlockEditorProps) {
  const [flat, setFlat] = useState<FlatBlock[]>(() => flattenTree(initialBlocks));
  const collabProcedureId = parent.type === "procedure" ? parent.id : "";
  const { doc, provider, getFragment } = useCollaborativeEditor({ procedureId: collabProcedureId, token: collabToken });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const createBlockEndpoint = parent.type === "procedure" ? `/api/procedures/${parent.id}/blocks` : `/api/pages/${parent.id}/blocks`;

  const tree = useMemo(() => buildClientTree(flat), [flat]);

  const handleTextChangeImpl = useCallback((blockId: string, text: any[]) => {
    // PATCH replaces the whole Json `content` column (no server-side merge),
    // so the payload must carry the full merged content — not just { text }
    // — or a stray update (e.g. Tiptap firing onUpdate on mount) silently
    // wipes sibling fields like checked/url/rows on non-paragraph blocks.
    setFlat((prev) => {
      const next = prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, text } } : b));
      const updated = next.find((b) => b.id === blockId);
      if (updated) {
        api(`/api/blocks/${blockId}`, { method: "PATCH", body: JSON.stringify({ content: updated.content }) }).catch(() => {});
      }
      return next;
    });
  }, []);

  const handleContentChangeImpl = useCallback((blockId: string, content: any) => {
    setFlat((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    api(`/api/blocks/${blockId}`, { method: "PATCH", body: JSON.stringify({ content }) }).catch(() => {});
  }, []);

  const handleDeleteImpl = useCallback((blockId: string) => {
    setFlat((prev) => prev.filter((b) => b.id !== blockId && b.parentBlockId !== blockId));
    api(`/api/blocks/${blockId}`, { method: "DELETE" }).catch(() => {});
  }, []);

  const handleSelectBlockTypeImpl = useCallback(
    (afterBlockId: string, type: BlockType) => {
      setFlat((prev) => {
        const after = prev.find((b) => b.id === afterBlockId);
        if (!after) return prev;
        const insertOrder = after.sortOrder + 1;
        const shifted = prev.map((b) =>
          b.parentBlockId === after.parentBlockId && b.sortOrder >= insertOrder && b.id !== after.id
            ? { ...b, sortOrder: b.sortOrder + 1 }
            : b
        );

        api(createBlockEndpoint, {
          method: "POST",
          body: JSON.stringify({
            type,
            content: defaultContentFor(type),
            parentBlockId: after.parentBlockId,
            sortOrder: insertOrder,
          }),
        })
          .then(({ block }) => {
            setFlat((cur) => [
              ...cur,
              {
                id: block.id,
                type: block.type,
                content: block.content,
                parentBlockId: block.parentBlockId,
                sortOrder: block.sortOrder,
              },
            ]);
          })
          .catch(() => {});

        return shifted;
      });
    },
    [createBlockEndpoint]
  );

  const handleEnterImpl = useCallback(
    (blockId: string) => handleSelectBlockTypeImpl(blockId, "PARAGRAPH"),
    [handleSelectBlockTypeImpl]
  );

  const handleBackspaceEmptyImpl = useCallback(
    (blockId: string) => {
      setFlat((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== blockId && b.parentBlockId !== blockId)));
      api(`/api/blocks/${blockId}`, { method: "DELETE" }).catch(() => {});
    },
    []
  );

  // Stable identities for everything handed down into a per-block Tiptap
  // instance — see useStableCallback's doc comment for why this matters.
  const onTextChange = useStableCallback(handleTextChangeImpl);
  const onContentChange = useStableCallback(handleContentChangeImpl);
  const onSelectBlockType = useStableCallback(handleSelectBlockTypeImpl);
  const onEnter = useStableCallback(handleEnterImpl);
  const onBackspaceEmpty = useStableCallback(handleBackspaceEmptyImpl);
  const onDelete = useStableCallback(handleDeleteImpl);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFlat((prev) => {
      const rootIds = buildClientTree(prev).map((b) => b.id);
      const oldIndex = rootIds.indexOf(String(active.id));
      const newIndex = rootIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(rootIds, oldIndex, newIndex);
      reordered.forEach((id, idx) => {
        api(`/api/blocks/${id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: idx }) }).catch(() => {});
      });

      const order = new Map(reordered.map((id, idx) => [id, idx]));
      return prev.map((b) => (order.has(b.id) ? { ...b, sortOrder: order.get(b.id)! } : b));
    });
  }, []);

  const handleAddBlockAtEnd = useCallback(() => {
    setFlat((prev) => {
      const roots = buildClientTree(prev);
      const last = roots[roots.length - 1];
      if (last) {
        handleSelectBlockTypeImpl(last.id, "PARAGRAPH");
        return prev;
      }
      // No blocks yet (new page, or a legacy procedure never opened in the
      // block editor) — handleSelectBlockTypeImpl always inserts *after* an
      // existing block, so the very first block needs its own path instead
      // of silently doing nothing when there's no "last" to hang off of.
      api(createBlockEndpoint, {
        method: "POST",
        body: JSON.stringify({ type: "PARAGRAPH", content: defaultContentFor("PARAGRAPH"), parentBlockId: null, sortOrder: 0 }),
      })
        .then(({ block }) => {
          setFlat((cur) => [
            ...cur,
            { id: block.id, type: block.type, content: block.content, parentBlockId: block.parentBlockId, sortOrder: block.sortOrder },
          ]);
        })
        .catch(() => {});
      return prev;
    });
  }, [handleSelectBlockTypeImpl, createBlockEndpoint]);

  // Degraded mode: collab-token fetch failed, or collab-server unreachable —
  // still fully usable, just without live cross-session text merge.
  const collabActive = Boolean(collabToken) && Boolean(doc);
  const fragmentGetter = useCallback(
    (blockId: string) => (collabActive ? getFragment(blockId) : null),
    [collabActive, getFragment]
  );

  return (
    <div className="space-y-0.5 rounded-lg border border-border bg-card p-4">
      {collabToken && !doc && (
        <p className="pb-2 text-xs text-muted-foreground">Connessione alla sessione collaborativa…</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tree.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {tree.map((block, i) => (
            <SortableItem
              key={block.id}
              block={block}
              numberedIndex={block.type === "NUMBERED_LIST_ITEM" ? i + 1 : undefined}
              editable={editable}
              getFragment={fragmentGetter}
              provider={collabActive ? provider : null}
              user={user}
              onTextChange={onTextChange}
              onContentChange={onContentChange}
              onSelectBlockType={onSelectBlockType}
              onEnter={onEnter}
              onBackspaceEmpty={onBackspaceEmpty}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      </DndContext>
      {editable && (
        <button
          type="button"
          onClick={handleAddBlockAtEnd}
          className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Aggiungi blocco
        </button>
      )}
    </div>
  );
}
