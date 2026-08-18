"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  procedureId,
  initialFavorited,
}: {
  procedureId: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    // Optimistic update.
    const next = !favorited;
    setFavorited(next);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedureId }),
      });
      const data = await res.json();
      if (typeof data.favorited === "boolean") setFavorited(data.favorited);
    } catch {
      setFavorited(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={favorited ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        favorited
          ? "border-stamp-amber/40 bg-stamp-amber/10 text-stamp-amber"
          : "border-border hover:bg-muted"
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className={cn("h-4 w-4", favorited && "fill-current")} />
      )}
      <span className="hidden sm:inline">{favorited ? "Salvata" : "Salva"}</span>
    </button>
  );
}
