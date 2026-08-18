"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const REASON_LABEL: Record<string, string> = {
  denied: "Autorizzazione negata su Slack.",
  session_expired: "Sessione scaduta — accedi di nuovo e riprova.",
  missing_params: "Risposta di Slack incompleta.",
  invalid_state: "Link scaduto, riprova.",
  state_mismatch: "Link non corrisponde alla sessione corrente, riprova.",
  exchange_failed: "Slack non ha confermato l'account — riprova.",
};

/** Fires a one-shot toast for the ?slack=connected|error redirect from the OAuth callback, then strips the query params so a refresh doesn't re-fire it. */
export function SlackOAuthStatusToast({ status, reason }: { status?: string; reason?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!status) return;
    if (status === "connected") toast.success("Slack collegato.");
    else toast.error(REASON_LABEL[reason ?? ""] ?? "Impossibile collegare Slack.");
    router.replace("/settings/notifications");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reason]);

  return null;
}
