"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Youtube from "@tiptap/extension-youtube";
import Placeholder from "@tiptap/extension-placeholder";
import { SlashCommand } from "./slash-command";
import {
  Bold, Italic, List, ListOrdered, Table as TableIcon, CheckSquare,
  Image as ImageIcon, Link as LinkIcon, Youtube as YoutubeIcon,
  Heading1, Heading2, Quote, Code, Undo, Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Notion-style rich content editor for procedures. Supports text, images,
 * tables, checklists, embedded video, links, and code blocks — the format
 * set called out in the functional requirements (section 4, "Editor interno").
 * File attachments (PDF/DOCX/XLSX/ZIP) are handled separately by the
 * AttachmentsPanel component (procedure detail page), not inline in the
 * document body.
 */

interface ProcedureEditorProps {
  content?: any;
  onChange: (json: any, html: string) => void;
  editable?: boolean;
}

export function ProcedureEditor({ content, onChange, editable = true }: ProcedureEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ HTMLAttributes: { class: "rounded-sm border border-border" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Youtube.configure({ width: 640, height: 360 }),
      Placeholder.configure({
        placeholder: "Scrivi qualcosa, oppure premi '/' per i comandi…",
      }),
      SlashCommand,
    ],
    content,
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "max-w-none px-6 py-5 min-h-[400px] focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: any }) {
  const insertImage = () => {
    const url = window.prompt("URL immagine");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const insertLink = () => {
    const url = window.prompt("URL link");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  };
  const insertVideo = () => {
    const url = window.prompt("URL video YouTube");
    if (url) editor.commands.setYoutubeVideo({ src: url });
  };
  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const buttons = [
    { icon: Heading1, label: "Titolo 1", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive("heading", { level: 1 }) },
    { icon: Heading2, label: "Titolo 2", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { icon: Bold, label: "Grassetto", action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, label: "Corsivo", action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: List, label: "Elenco puntato", action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, label: "Elenco numerato", action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
    { icon: CheckSquare, label: "Checklist", action: () => editor.chain().focus().toggleTaskList().run(), active: editor.isActive("taskList") },
    { icon: Quote, label: "Citazione", action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
    { icon: Code, label: "Codice", action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive("codeBlock") },
    { icon: TableIcon, label: "Tabella", action: insertTable, active: false },
    { icon: ImageIcon, label: "Immagine", action: insertImage, active: false },
    { icon: LinkIcon, label: "Link", action: insertLink, active: editor.isActive("link") },
    { icon: YoutubeIcon, label: "Video YouTube", action: insertVideo, active: false },
  ];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur">
      {buttons.map(({ icon: Icon, label, action, active }, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={action}
              className={cn("h-8 w-8", active && "bg-muted text-primary")}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
      <span className="mx-1 h-5 w-px bg-border" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Annulla</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ripeti</TooltipContent>
      </Tooltip>
    </div>
  );
}
