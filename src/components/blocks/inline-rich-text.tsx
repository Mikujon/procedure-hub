"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import Bold from "@tiptap/extension-bold";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Code from "@tiptap/extension-code";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import type { HocuspocusProvider } from "@hocuspocus/provider";
import type * as Y from "yjs";
import { useEffect, useRef } from "react";
import type { BlockType } from "@prisma/client";
import { SlashCommandMenu } from "./slash-command-menu";

interface InlineRichTextProps {
  /** ProseMirror inline node array — Block.content.text shape. Only used when fragment is null (degraded, non-collab mode). */
  initialContent: any[];
  /** Null = not connected to collab-server (degraded mode: plain PATCH-only editing, no live merge). */
  fragment: Y.XmlFragment | null;
  provider: HocuspocusProvider | null;
  user: { name: string; color: string };
  editable: boolean;
  placeholder?: string;
  className?: string;
  /** Debounced mirror of the current inline content back to Postgres (source of truth for publish). */
  onTextChange: (json: any[]) => void;
  onSelectBlockType: (type: BlockType) => void;
  onEnter?: () => void;
  onBackspaceEmpty?: () => void;
}

/**
 * One block's rich text, as its own small Tiptap instance (Document +
 * Paragraph + Text + a few marks — no headings/lists nested in here, block
 * *type* carries that instead). When `fragment` is set, content lives in
 * Yjs and syncs live across sessions; either way, edits are also mirrored
 * (debounced) to Postgres via onTextChange so Block.content stays the
 * source of truth the publish route serializes from.
 */
export function InlineRichText({
  initialContent,
  fragment,
  provider,
  user,
  editable,
  placeholder,
  className,
  onTextChange,
  onSelectBlockType,
  onEnter,
  onBackspaceEmpty,
}: InlineRichTextProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor(
    {
      extensions: [
        Document,
        Paragraph,
        Text,
        Bold,
        Italic,
        Strike,
        Code,
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: placeholder ?? "" }),
        SlashCommandMenu.configure({ onSelectType: onSelectBlockType }),
        ...(fragment ? [Collaboration.configure({ fragment })] : []),
        ...(fragment && provider
          ? [CollaborationCursor.configure({ provider, user })]
          : []),
      ],
      content: fragment ? undefined : { type: "doc", content: [{ type: "paragraph", content: initialContent }] },
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: { class: ["block-inline-text", className].filter(Boolean).join(" ") },
        handleKeyDown: (_view, event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            onEnter?.();
            return true;
          }
          if (event.key === "Backspace" && editor?.state.doc.textContent === "") {
            onBackspaceEmpty?.();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor: ed }) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const json = ed.getJSON();
          onTextChange(json.content?.[0]?.content ?? []);
        }, 600);
      },
    },
    [fragment]
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
