"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Check } from "lucide-react";

export function AcknowledgeButton({
  procedureId,
  alreadyAcknowledged,
}: {
  procedureId: string;
  alreadyAcknowledged: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(alreadyAcknowledged);

  async function acknowledge() {
    setBusy(true);
    await fetch("/api/acknowledgments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ procedureId }),
    });
    setBusy(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-sm border-2 border-[hsl(var(--stamp-green))] bg-[hsl(var(--stamp-green))]/10 px-3 py-2 text-sm font-medium text-[hsl(var(--stamp-green))]">
        <Check className="h-4 w-4" /> Lettura confermata
      </div>
    );
  }

  return (
    <button
      disabled={busy}
      onClick={acknowledge}
      className="flex w-full items-center justify-center gap-2 rounded-sm border-2 border-[hsl(var(--stamp-amber))] px-3 py-2 text-sm font-medium text-[hsl(var(--stamp-amber))] hover:bg-[hsl(var(--stamp-amber))]/10 disabled:opacity-50"
    >
      <ShieldCheck className="h-4 w-4" /> Conferma di aver letto questa procedura
    </button>
  );
}
