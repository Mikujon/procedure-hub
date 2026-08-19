"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Send, Archive, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface WorkflowPanelProps {
  procedureId: string;
  status: string;
  pendingStepId: string | null;
  pendingStage: string | null;
  canSubmit: boolean;
  canDecide: boolean;
  canArchive: boolean;
}

export function WorkflowPanel({
  procedureId,
  status,
  pendingStepId,
  pendingStage,
  canSubmit,
  canDecide,
  canArchive,
}: WorkflowPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");

  async function submit() {
    setBusy(true);
    await fetch(`/api/procedures/${procedureId}/submit`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!pendingStepId) return;
    setBusy(true);
    await fetch(`/api/procedures/${procedureId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: pendingStepId, decision, comment: comment || undefined }),
    });
    setBusy(false);
    setComment("");
    router.refresh();
  }

  async function archive() {
    if (!confirm("Archiviare questa procedura? Non sarà più visibile come attiva.")) return;
    setBusy(true);
    await fetch(`/api/procedures/${procedureId}/archive`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <Card className="opacity-0 animate-rise">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Flusso di approvazione</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {status === "DRAFT" && canSubmit && (
          <Button disabled={busy} onClick={submit} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invia in revisione
          </Button>
        )}

        {pendingStepId && canDecide && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              In attesa di decisione: <span className="font-medium text-foreground">{pendingStage?.replace("_", " ")}</span>
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Commento (opzionale)"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() => decide("APPROVED")}
                className="flex-1 bg-[hsl(var(--stamp-green))] text-white hover:bg-[hsl(var(--stamp-green))]/90"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approva
              </Button>
              <Button disabled={busy} onClick={() => decide("REJECTED")} variant="destructive" className="flex-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rifiuta
              </Button>
            </div>
          </div>
        )}

        {status === "PUBLISHED" && canArchive && (
          <Button disabled={busy} onClick={archive} variant="outline" className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />} Archivia
          </Button>
        )}

        {!canSubmit && !canDecide && status === "DRAFT" && (
          <p className="text-xs text-muted-foreground">Solo autori ed editor del dipartimento possono inviare in revisione.</p>
        )}
      </CardContent>
    </Card>
  );
}
