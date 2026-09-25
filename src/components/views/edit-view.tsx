"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Save,
  Loader2,
  Plus,
  X,
  Clock,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useProcedure, useSaveContent } from "@/lib/hooks";
import { toast } from "sonner";
import { BlockEditor } from "@/components/editor/block-editor";
import { StatusBadge, CriticalityBadge } from "@/components/shared/badges";
import type { Block, Criticality } from "@/lib/types";
import { CRITICALITY_CONFIG } from "@/lib/domain";
import { cn } from "@/lib/utils";

const CRIT_OPTIONS: Criticality[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function EditView() {
  const { selectedProcedureId, openProcedure, editProcedure } = useAppStore();
  const { data: proc, isLoading } = useProcedure(selectedProcedureId);
  const save = useSaveContent(selectedProcedureId);

  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [criticality, setCriticality] = React.useState<Criticality>("MEDIUM");
  const [readMinutes, setReadMinutes] = React.useState(5);
  const [tagInput, setTagInput] = React.useState("");
  const [dirty, setDirty] = React.useState(false);

  // hydrate from server data
  React.useEffect(() => {
    if (proc) {
      setBlocks(proc.content);
      setTitle(proc.title);
      setSummary(proc.summary);
      setTags(proc.tags);
      setCriticality(proc.criticality);
      setReadMinutes(proc.readMinutes);
      setDirty(false);
    }
  }, [proc?.id, proc?.content]);

  const markDirty = React.useCallback(() => setDirty(true), []);

  const onBlocksChange = (b: Block[]) => {
    setBlocks(b);
    markDirty();
  };

  const onSave = () => {
    if (!selectedProcedureId) return;
    save.mutate(
      {
        content: blocks,
        title,
        summary,
        tags,
        criticality,
        readMinutes,
      },
      {
        onSuccess: () => {
          toast.success("Procedure saved", {
            description: "Changes are recorded in the audit trail.",
          });
          setDirty(false);
        },
        onError: (e: any) => toast.error(e.message ?? "Save failed"),
      }
    );
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
      markDirty();
    }
    setTagInput("");
  };

  if (isLoading || !proc) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <div className="h-8 w-1/3 rounded bg-muted shimmer" />
          <div className="h-24 rounded bg-muted shimmer" />
        </div>
        <div className="h-64 rounded-xl bg-muted/40 shimmer" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid gap-8 lg:grid-cols-[1fr_300px]"
    >
      <div className="min-w-0">
        {/* toolbar */}
        <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openProcedure(proc.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <span className="font-mono text-xs text-muted-foreground">{proc.code}</span>
            <StatusBadge status={proc.status} size="sm" />
            {dirty && (
              <span className="inline-flex items-center gap-1 text-[11px] text-status-review">
                <span className="h-1.5 w-1.5 rounded-full bg-status-review" />
                unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openProcedure(proc.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </button>
            <button
              onClick={onSave}
              disabled={save.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-[var(--shadow-soft)] hover:brightness-105 disabled:opacity-60"
            >
              {save.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        </div>

        {/* title + summary */}
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markDirty();
          }}
          placeholder="Untitled procedure"
          className="font-display w-full rounded-lg border border-transparent bg-transparent text-3xl sm:text-4xl font-medium tracking-tight focus:border-border focus:bg-card focus:outline-none px-2 -mx-2"
        />
        <textarea
          value={summary}
          onChange={(e) => {
            setSummary(e.target.value);
            markDirty();
          }}
          placeholder="One-line summary…"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 text-[15px] text-muted-foreground focus:border-border focus:bg-card focus:outline-none"
        />

        {/* block editor */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
          <BlockEditor value={blocks} onChange={onBlocksChange} />
        </div>
      </div>

      {/* metadata sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metadata
          </p>

          {/* criticality */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Criticality</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CRIT_OPTIONS.map((c) => {
                const cfg = CRITICALITY_CONFIG[c];
                const active = criticality === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setCriticality(c);
                      markDirty();
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? `${cfg.bg} ${cfg.color} border-current/30`
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <cfg.icon className="h-3 w-3" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* read time */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Clock className="h-3.5 w-3.5" /> Read time (minutes)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={readMinutes}
              onChange={(e) => {
                setReadMinutes(Number(e.target.value) || 1);
                markDirty();
              }}
              className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>

          {/* tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {t}
                  <button
                    onClick={() => {
                      setTags(tags.filter((x) => x !== t));
                      markDirty();
                    }}
                    className="hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="add tag"
                className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              <button
                onClick={addTag}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <CriticalityBadge criticality={criticality} />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Editing version v{proc.version}. Saving updates the content and logs an
              audit entry — the status workflow is unchanged.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Editor tips</p>
          <ul className="space-y-0.5">
            <li>· Hover a block for drag / delete controls</li>
            <li>· Use the <kbd className="rounded bg-card px-1">+</kbd> handle to insert below</li>
            <li>· Drag the grip to reorder blocks</li>
          </ul>
        </div>
      </aside>
    </motion.div>
  );
}
