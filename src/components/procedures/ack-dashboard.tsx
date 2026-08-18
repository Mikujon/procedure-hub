"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface AckUser {
  id: string;
  name: string;
  email: string;
}

interface AckRow {
  userId: string;
  acknowledgedAt: string;
  user: AckUser;
}

interface Data {
  acknowledged: AckRow[];
  outstanding: AckUser[];
  campaign: { startedAt: string; completedAt: string | null; targetCount: number } | null;
}

/** Read & Acknowledge completion dashboard — visible to Owner/Admin/Compliance Officer on a procedure's detail page (Fase 4). */
export function AckDashboard({ procedureId }: { procedureId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/acknowledgments?procedureId=${procedureId}`)
      .then((r) => r.json())
      .then((d) => active && setData(d));
    return () => {
      active = false;
    };
  }, [procedureId]);

  if (!data || !data.campaign) return null;

  const total = data.campaign.targetCount;
  const done = data.acknowledged.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const completed = Boolean(data.campaign.completedAt);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Read &amp; Acknowledge</p>
        {completed && (
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
            <a href={`/api/procedures/${procedureId}/ack-certificate`}>
              <Download className="h-3 w-3" /> Certificato
            </a>
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-lg font-semibold tabular-nums">
            {done}/{total}
          </span>
          <span className={`text-xs font-medium ${completed ? "text-stamp-green" : "text-muted-foreground"}`}>
            {completed ? "Completato" : `${pct}%`}
          </span>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${completed ? "bg-stamp-green" : "bg-stamp-amber"}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {data.outstanding.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{data.outstanding.length} in attesa</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}

        {expanded && (
          <ul className="mt-2 space-y-1 border-t border-border pt-2">
            {data.outstanding.map((u) => (
              <li key={u.id} className="truncate text-xs text-muted-foreground">
                {u.name}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
