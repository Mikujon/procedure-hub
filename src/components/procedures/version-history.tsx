"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface VersionItem {
  id: string;
  versionNumber: number;
  createdAt: string;
  authorName: string;
  changelog: string | null;
}

/** "Cronologia versioni" list, extended with a 2-version picker that hands off to the compare page. */
export function VersionHistory({ procedureId, versions }: { procedureId: string; versions: VersionItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);

  function toggle(versionNumber: number) {
    setSelected((s) => {
      if (s.includes(versionNumber)) return s.filter((v) => v !== versionNumber);
      if (s.length >= 2) return [s[1], versionNumber]; // drop the oldest pick, keep the two most recent clicks
      return [...s, versionNumber];
    });
  }

  function compare() {
    if (selected.length !== 2) return;
    const [from, to] = [...selected].sort((a, b) => a - b);
    router.push(`/procedures/${procedureId}/versions/compare?from=${from}&to=${to}`);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {versions.map((v, i) => (
          <li
            key={v.id}
            className="flex items-start gap-2 text-xs opacity-0 animate-rise"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {versions.length > 1 && (
              <input
                type="checkbox"
                className="mt-0.5 h-3 w-3 shrink-0 accent-primary"
                checked={selected.includes(v.versionNumber)}
                onChange={() => toggle(v.versionNumber)}
                aria-label={`Seleziona v${v.versionNumber} per il confronto`}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium">v{v.versionNumber}</span>
                <span className="text-muted-foreground">{formatDate(v.createdAt)}</span>
              </div>
              <p className="truncate text-muted-foreground">
                {v.authorName}
                {v.changelog ? ` — ${v.changelog}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {versions.length > 1 && (
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" disabled={selected.length !== 2} onClick={compare}>
          <GitCompare className="h-3.5 w-3.5" />
          Confronta versioni selezionate
        </Button>
      )}
    </div>
  );
}
