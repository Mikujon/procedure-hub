"use client";

import { useEffect, useRef, useState } from "react";
import { Search, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ScanBar } from "@/components/ui/scan-bar";

interface SearchHit {
  id: string;
  title: string;
  code: string;
  departmentName: string;
  type: string;
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query) {
      setHits([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setHits(data.hits ?? []);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center gap-2 overflow-hidden rounded-sm border border-border bg-background px-3 py-2">
        {loading && <ScanBar />}
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca procedure, policy, work instruction..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {open && query && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-sm border border-border bg-card shadow-lg">
          {hits.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nessun risultato per &ldquo;{query}&rdquo;
            </p>
          ) : (
            hits.map((hit) => (
              <Link
                key={hit.id}
                href={`/procedures/${hit.id}`}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{hit.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {hit.code} · {hit.departmentName}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
