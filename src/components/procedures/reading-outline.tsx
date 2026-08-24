"use client";

import { useEffect, useState } from "react";
import { ListTree } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TocHeading } from "@/lib/toc";

/**
 * Floating outline for the *reading* view of a procedure — follows scroll,
 * highlights the section currently in view, click jumps to it. Anchor ids
 * come from lib/toc.ts (same ids an inline TABLE_OF_CONTENTS block links
 * to), so this and that block always agree on where "#introduzione" is.
 *
 * Not worth a panel under two headings — a single-section procedure has
 * nothing to navigate, and the sidebar column is already busy (workflow,
 * details, version history).
 */
export function ReadingOutline({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length < 2) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      // Treats a heading as "active" once it crosses just below the top of
      // the scroll area, and stops counting a section once its heading has
      // scrolled most of the way back up — a normal "top of viewport"
      // scrollspy band, not tied to the topbar (main scrolls independently
      // of it, see (app)/layout.tsx).
      { rootMargin: "-16px 0px -70% 0px", threshold: 0 }
    );

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <Card className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ListTree className="h-4 w-4" /> Indice
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <nav aria-label="Indice della procedura" className="space-y-0.5 text-sm">
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={{ paddingLeft: `${(h.level - 1) * 0.75 + 0.5}rem` }}
              className={cn(
                "block truncate border-l-2 py-1 pr-2 transition-colors",
                activeId === h.id
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
