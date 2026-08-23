"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, FileCheck2, GitPullRequestArrow, Megaphone, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  APPROVAL_REQUESTED: GitPullRequestArrow,
  APPROVAL_DECIDED: FileCheck2,
  PUBLISHED: FileCheck2,
  UPDATED: FileCheck2,
  REVIEW_DUE: Clock,
  ANNOUNCEMENT: Megaphone,
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "adesso";
  if (m < 60) return `${m} min fa`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h fa`;
  const d = Math.floor(h / 24);
  return `${d} g fa`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setItems(data.notifications ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
  }

  async function markOne(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between opacity-0 animate-rise">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Notifiche</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread > 0 ? `${unread} non lette` : "Tutto letto"}
          </p>
        </div>
        {unread > 0 && (
          <Button onClick={markAll} variant="outline">
            <CheckCheck className="h-4 w-4" /> Segna tutte come lette
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-20 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Nessuna notifica.</p>
        </div>
      ) : (
        <Card className="overflow-hidden">
          {items.map((n, i) => {
            const Icon = ICONS[n.type] ?? Bell;
            const delay = Math.min(i, 15) * 40;
            const inner = (
              <div
                className={cn(
                  "flex items-start gap-3 border-b border-border px-4 py-3.5 transition-colors last:border-0",
                  n.readAt ? "opacity-70" : "bg-primary/[0.03]"
                )}
              >
                <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", n.readAt ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </div>
            );
            return n.linkUrl ? (
              <Link
                key={n.id}
                href={n.linkUrl}
                onClick={() => markOne(n.id)}
                className="block opacity-0 animate-rise hover:bg-muted/50"
                style={{ animationDelay: `${delay}ms` }}
              >
                {inner}
              </Link>
            ) : (
              <button
                key={n.id}
                onClick={() => markOne(n.id)}
                className="block w-full text-left opacity-0 animate-rise hover:bg-muted/50"
                style={{ animationDelay: `${delay}ms` }}
              >
                {inner}
              </button>
            );
          })}
        </Card>
      )}
    </div>
  );
}
