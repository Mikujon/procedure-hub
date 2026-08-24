"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Link2,
  ClipboardCopy,
  CopyPlus,
  ALargeSmall,
  StretchHorizontal,
  Lock,
  LockOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProcedureViewPrefs } from "./procedure-view-shell";

interface PageOptionsMenuProps {
  procedureId: string;
  /** Plain-text extract of the current version's content — "Copia contenuto pagina" copies exactly this, nothing re-derived client-side. */
  contentText: string;
  canDuplicate: boolean;
  /** Locking is a governance action (same bar as publish), not a plain edit — see canPublishProcedure. */
  canLock: boolean;
  initialLocked: boolean;
}

export function PageOptionsMenu({ procedureId, contentText, canDuplicate, canLock, initialLocked }: PageOptionsMenuProps) {
  const router = useRouter();
  const { fullWidth, smallText, setFullWidth, setSmallText } = useProcedureViewPrefs();
  const [locked, setLocked] = useState(initialLocked);
  const [duplicating, setDuplicating] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiato");
  }

  async function copyContents() {
    await navigator.clipboard.writeText(contentText || "(pagina vuota)");
    toast.success("Contenuto copiato");
  }

  async function duplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/procedures/${procedureId}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Duplicazione non riuscita");
      toast.success("Procedura duplicata");
      router.push(`/procedures/${data.procedure.id}/edit`);
    } catch (e: any) {
      toast.error(e.message ?? "Duplicazione non riuscita");
      setDuplicating(false);
    }
  }

  async function toggleLock() {
    const next = !locked;
    setTogglingLock(true);
    try {
      const res = await fetch(`/api/procedures/${procedureId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Operazione non riuscita");
      setLocked(next);
      toast.success(next ? "Pagina bloccata" : "Pagina sbloccata");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Operazione non riuscita");
    } finally {
      setTogglingLock(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Opzioni pagina">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onClick={copyLink}>
          <Link2 className="h-4 w-4 text-muted-foreground" /> Copia link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyContents}>
          <ClipboardCopy className="h-4 w-4 text-muted-foreground" /> Copia contenuto pagina
        </DropdownMenuItem>
        {canDuplicate && (
          <DropdownMenuItem onClick={duplicate} disabled={duplicating}>
            <CopyPlus className="h-4 w-4 text-muted-foreground" /> {duplicating ? "Duplicazione…" : "Duplica"}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">Visualizzazione (solo per te)</DropdownMenuLabel>
        <DropdownMenuCheckboxItem checked={smallText} onCheckedChange={setSmallText} onSelect={(e) => e.preventDefault()}>
          <ALargeSmall className="mr-2 h-4 w-4 text-muted-foreground" /> Testo piccolo
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem checked={fullWidth} onCheckedChange={setFullWidth} onSelect={(e) => e.preventDefault()}>
          <StretchHorizontal className="mr-2 h-4 w-4 text-muted-foreground" /> Larghezza intera
        </DropdownMenuCheckboxItem>

        {canLock && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={toggleLock} disabled={togglingLock}>
              {locked ? (
                <LockOpen className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              {locked ? "Sblocca pagina" : "Blocca pagina"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
