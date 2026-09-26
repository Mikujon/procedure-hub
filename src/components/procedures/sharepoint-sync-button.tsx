"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Only rendered by the server component when a SHAREPOINT integration is enabled for the tenant — see procedures/[id]/page.tsx. */
export function SharePointSyncButton({ procedureId }: { procedureId: string }) {
  const [busy, setBusy] = useState(false);

  async function sync() {
    setBusy(true);
    try {
      const res = await fetch(`/api/procedures/${procedureId}/sync-sharepoint`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Sincronizzazione non riuscita");
        return;
      }
      toast.success("Sincronizzato su SharePoint", {
        action: { label: "Apri", onClick: () => window.open(data.webUrl, "_blank") },
      });
    } catch {
      toast.error("Sincronizzazione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={sync} disabled={busy}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
      SharePoint
    </Button>
  );
}
