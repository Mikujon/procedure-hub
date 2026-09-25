"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Library,
  LayoutGrid,
  List,
  ArrowUpDown,
  Star,
  X,
  Search,
  FolderKanban,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBootstrap, useProcedures } from "@/lib/hooks";
import { ProcedureCard } from "@/components/procedure/procedure-card";
import { EmptyState } from "@/components/shared/layout-primitives";
import { DynamicIcon } from "@/components/shared/dynamic-icon";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG } from "@/lib/domain";
import type { ProcedureStatus } from "@/lib/types";

const SORTS = [
  { key: "updated", label: "Recently updated" },
  { key: "title", label: "Title (A–Z)" },
  { key: "code", label: "Code (A–Z)" },
  { key: "review", label: "Next review" },
];

export function LibraryView() {
  const {
    departmentFilter,
    setDepartmentFilter,
    statusFilter,
    setStatusFilter,
    openProcedure,
  } = useAppStore();
  const { data: bootstrap } = useBootstrap();
  const [layout, setLayout] = React.useState<"grid" | "list">("list");
  const [sort, setSort] = React.useState("updated");
  const [search, setSearch] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState<string | null>(null);

  const departments = bootstrap?.departments ?? [];

  const params: Record<string, string | undefined> = { sort };
  if (departmentFilter) params.departmentId = departmentFilter;
  if (statusFilter) params.status = statusFilter;
  if (search) params.q = search;
  const { data: procedures, isLoading } = useProcedures(params);

  const filtered = (procedures ?? []).filter((p: any) =>
    tagFilter ? p.tags.includes(tagFilter) : true
  );

  // collect available tags from current set
  const allTags = React.useMemo(() => {
    const set = new Set<string>();
    (procedures ?? []).forEach((p: any) => p.tags.forEach((t: string) => set.add(t)));
    return Array.from(set).sort();
  }, [procedures]);

  const activeDept = departments.find((d) => d.id === departmentFilter);

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Department tree */}
      <aside className="lg:sticky lg:top-20 lg:self-start space-y-1">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Departments
          </p>
          {departmentFilter && (
            <button
              onClick={() => setDepartmentFilter(null)}
              className="text-[11px] text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <button
          onClick={() => setDepartmentFilter(null)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
            !departmentFilter
              ? "bg-sidebar-accent text-foreground font-medium"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <FolderKanban className="h-4 w-4" />
          All procedures
          <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
            {departments.reduce((s, d) => s + d.procedureCount, 0)}
          </span>
        </button>
        {departments.map((d: any) => (
          <div key={d.id}>
            <button
              onClick={() => setDepartmentFilter(departmentFilter === d.id ? null : d.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                departmentFilter === d.id
                  ? "bg-sidebar-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <DynamicIcon name={d.icon} className="h-4 w-4" style={{ color: d.color }} />
              <span className="flex-1 text-left truncate">{d.name}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {d.procedureCount}
              </span>
            </button>
            {departmentFilter === d.id && d.processes.length > 0 && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="ml-3 border-l border-border pl-2 mt-0.5 space-y-0.5"
              >
                {d.processes.map((pr: any) => (
                  <li key={pr.id} className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                    <span className="truncate">{pr.name}</span>
                    <span className="ml-auto tabular-nums">{pr.procedureCount}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </div>
        ))}
      </aside>

      {/* List */}
      <div className="space-y-4 min-w-0">
        {/* Header + controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-tight">
              {activeDept ? activeDept.name : "All procedures"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {filtered.length} procedure{filtered.length === 1 ? "" : "s"}
              {activeDept && ` · ${activeDept.description}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter…"
                className="h-9 w-40 rounded-lg border border-border bg-card pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </div>
            <SortMenu sort={sort} onSort={setSort} />
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setLayout("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  layout === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setLayout("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  layout === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              !statusFilter
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            )}
          >
            All statuses
          </button>
          {(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"] as ProcedureStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? null : s)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? `${cfg.border} ${cfg.bg} ${cfg.color}`
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                )}
              >
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Active filters */}
        {(tagFilter || search) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Active filters:</span>
            {search && (
              <FilterChip label={`"${search}"`} onClear={() => setSearch("")} />
            )}
            {tagFilter && (
              <FilterChip label={`#${tagFilter}`} onClear={() => setTagFilter(null)} />
            )}
          </div>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="h-3 w-1/4 rounded bg-muted shimmer" />
                <div className="h-4 w-3/4 rounded bg-muted shimmer" />
                <div className="h-3 w-1/2 rounded bg-muted shimmer" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Library className="h-5 w-5" />}
            title="No procedures found"
            description="Try adjusting your filters or clearing the search."
          />
        ) : layout === "grid" ? (
          <motion.div
            layout
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          >
            {filtered.map((p: any) => (
              <ProcedureCard key={p.id} proc={p} onOpen={openProcedure} layout="grid" />
            ))}
          </motion.div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p: any) => (
              <ProcedureCard key={p.id} proc={p} onOpen={openProcedure} layout="list" />
            ))}
          </div>
        )}

        {/* Tag cloud */}
        {allTags.length > 0 && (
          <div className="pt-4 border-t border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    tagFilter === t
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortMenu({ sort, onSort }: { sort: string; onSort: (s: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const current = SORTS.find((s) => s.key === sort) ?? SORTS[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-[var(--shadow-lift)]">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                onSort(s.key);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                s.key === sort ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
              )}
            >
              {s.label}
              {s.key === sort && <Star className="h-3 w-3 fill-primary text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
      {label}
      <button onClick={onClear} className="hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
