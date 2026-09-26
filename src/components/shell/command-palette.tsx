"use client";

import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Library,
  CheckCircle2,
  Star,
  ShieldCheck,
  FileText,
  CornerDownLeft,
  Moon,
  Sun,
  ArrowUp,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useKbSearch, useBootstrap } from "@/lib/hooks";
import { useTheme } from "next-themes";
import { StatusBadge } from "@/components/shared/badges";
import { DynamicIcon } from "@/components/shared/dynamic-icon";

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setView, openProcedure } = useAppStore();
  const [query, setQuery] = React.useState("");
  const { setTheme } = useTheme();
  const { data: kbData } = useKbSearch(query ? { q: query } : {});

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  const navItems = [
    { label: "Dashboard", view: "dashboard" as const, icon: LayoutDashboard },
    { label: "Le mie procedure", view: "b7" as const, icon: Library },
    { label: "Coda Compliance", view: "compliance" as const, icon: CheckCircle2 },
    { label: "Comunicazioni (HR-8)", view: "hr8" as const, icon: ShieldCheck },
    { label: "Policy e versioni (LG-2)", view: "lg2" as const, icon: ShieldCheck },
    { label: "Prese visione (LG-4)", view: "lg4" as const, icon: CheckCircle2 },
    { label: "Admin Console", view: "admin" as const, icon: ShieldCheck },
  ];

  const results = (kbData?.results ?? []).slice(0, 6);

  return (
    <CommandDialog
      open={commandOpen}
      onOpenChange={(o) => {
        setCommandOpen(o);
        if (!o) setQuery("");
      }}
    >
      <CommandInput
        placeholder="Search procedures, navigate, or run a command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query ? `No procedures match “${query}”.` : "Start typing to search…"}
        </CommandEmpty>

        {query && results.length > 0 && (
          <CommandGroup heading="Procedures" className="[&_[cmdk-group-heading]]:text-muted-foreground">
            {results.map((p: any) => (
              <CommandItem
                key={p.id}
                value={`${p.code} ${p.title} ${p.tags.join(" ")}`}
                onSelect={() => {
                  openProcedure(p.id);
                  setCommandOpen(false);
                  setQuery("");
                }}
                className="gap-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                  <span className="truncate">{p.title}</span>
                  <span className="text-[10px] uppercase text-muted-foreground/60">{p.tipo}</span>
                </div>
                {p.obbligatorio && !p.acknowledged && (
                  <span className="text-[10px] font-medium text-status-review">da leggere</span>
                )}
                <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/50" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query && (
          <>
            <CommandGroup heading="Navigate" className="[&_[cmdk-group-heading]]:text-muted-foreground">
              {navItems.map((item) => (
                <CommandItem
                  key={item.view}
                  value={`go to ${item.label}`}
                  onSelect={() => {
                    setView(item.view);
                    setCommandOpen(false);
                  }}
                  className="gap-3"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{item.label}</span>
                  <kbd className="text-[10px] text-muted-foreground">G {item.label[0]}</kbd>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions" className="[&_[cmdk-group-heading]]:text-muted-foreground">
              <CommandItem
                value="toggle dark mode"
                onSelect={() => {
                  setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
                  setCommandOpen(false);
                }}
                className="gap-3"
              >
                {typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? (
                  <Sun className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Moon className="h-4 w-4 text-muted-foreground" />
                )}
                Toggle theme
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
