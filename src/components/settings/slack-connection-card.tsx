"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SlackConnectionCard({
  connected,
  teamId,
  configured,
}: {
  connected: boolean;
  teamId?: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/notifications/slack/oauth", { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnessione fallita");
      toast.success("Slack scollegato.");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Errore imprevisto");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm">Slack</CardTitle>
          <CardDescription>Ricevi promemoria e richieste di approvazione come DM su Slack.</CardDescription>
        </div>
        {connected && <Badge variant="secondary">Collegato</Badge>}
      </CardHeader>
      <CardContent>
        {!configured ? (
          <p className="text-sm text-muted-foreground">
            L&apos;amministratore non ha ancora configurato l&apos;app Slack per questo tenant.
          </p>
        ) : connected ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Team Slack: <span className="font-mono text-xs">{teamId}</span></p>
            <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Scollega
            </Button>
          </div>
        ) : (
          <Button asChild size="sm">
            <a href="/api/notifications/slack/oauth">Collega il tuo account Slack</a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
