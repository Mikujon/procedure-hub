"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { FileText, Users, AlertTriangle, CheckCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { cn } from "@/lib/utils";

interface KpiData {
  totalProcedures: number;
  activeUsers: number;
  byStatus: { status: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  upcomingReviews: { id: string; title: string; nextReviewDate: string; department: { name: string }; overdue: boolean }[];
  topTags: { name: string; count: number }[];
  ackCompletionRate: number | null;
  ackCampaignCount: number;
  pagesNeedingVerification: number;
}

// Derived from the same CSS variables as the rest of the UI (globals.css) —
// not hardcoded hex, so these charts stay in sync automatically instead of
// drifting from the palette like the previous literal #2F5D8C/#141A2E did
// (leftover from the old ink/paper direction, replaced app-wide since).
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--stamp-amber))",
  "hsl(var(--stamp-green))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--secondary-foreground))",
];

export function AdminDashboard() {
  const [data, setData] = useState<KpiData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/kpi")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error ?? `Errore (${r.status})`);
        setData(body);
      })
      .catch((e) => setError(e.message ?? "Errore imprevisto durante il caricamento."));
  }, []);

  if (error) return <p className="text-sm text-destructive">Impossibile caricare la dashboard: {error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard amministrativa</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={FileText} label="Procedure totali" value={data.totalProcedures} />
        <StatCard icon={Users} label="Utenti attivi" value={data.activeUsers} />
        <StatCard
          icon={AlertTriangle}
          label="In scadenza (30gg)"
          value={data.upcomingReviews.length}
          accent="warning"
        />
        <StatCard
          icon={FileText}
          label="Pubblicate"
          value={data.byStatus.find((s) => s.status === "PUBLISHED")?.count ?? 0}
          accent="success"
        />
        <StatCard
          icon={CheckCheck}
          label={`Conferme lettura completate${data.ackCampaignCount > 0 ? ` (${data.ackCampaignCount})` : ""}`}
          value={data.ackCompletionRate}
          suffix="%"
          accent={data.ackCompletionRate === null ? undefined : data.ackCompletionRate >= 100 ? "success" : "warning"}
        />
        <StatCard icon={ShieldAlert} label="Pagine da verificare" value={data.pagesNeedingVerification} accent={data.pagesNeedingVerification > 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Procedure per dipartimento</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byDepartment}>
                <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuzione per stato</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={data.byStatus} dataKey="count" nameKey="status" outerRadius={90} label>
                  {data.byStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b border-border py-4">
          <CardTitle className="text-sm">Prossime revisioni (30 giorni)</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {data.upcomingReviews.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.department.name}</p>
              </div>
              <div className="flex items-center gap-2">
                {p.overdue && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Scaduta</span>
                )}
                <span className={cn("font-mono text-xs", p.overdue ? "text-destructive" : "text-muted-foreground")}>
                  {new Date(p.nextReviewDate).toLocaleDateString("it-IT")}
                </span>
              </div>
            </div>
          ))}
          {data.upcomingReviews.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nessuna revisione imminente.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | null;
  suffix?: string;
  accent?: "warning" | "success";
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <Icon
          className={`mb-2 h-5 w-5 ${
            accent === "warning" ? "text-[hsl(var(--stamp-amber))]" : accent === "success" ? "text-[hsl(var(--stamp-green))]" : "text-primary"
          }`}
        />
        <p className="font-display text-2xl font-semibold">
          {value === null ? "—" : (
            <>
              <CountUp value={value} />
              {suffix}
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
