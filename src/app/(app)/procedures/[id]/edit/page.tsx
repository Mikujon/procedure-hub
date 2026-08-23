"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { BlockEditor } from "@/components/blocks/block-editor";
import type { ClientBlock } from "@/components/blocks/types";
import { Save } from "lucide-react";
import { colorForUser } from "@/lib/collab-colors";

export default function EditProcedurePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [blocks, setBlocks] = useState<ClientBlock[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [collabToken, setCollabToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const [procData, blocksData] = await Promise.all([
        fetch(`/api/procedures/${params.id}`).then((r) => r.json()),
        fetch(`/api/procedures/${params.id}/blocks`).then((r) => r.json()),
      ]);
      if (!active) return;
      setTitle(procData.procedure.title);
      setSummary(procData.procedure.summary ?? "");
      setBlocks(blocksData.blocks ?? []);

      try {
        const tokenRes = await fetch(`/api/procedures/${params.id}/collab-token`);
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (!active) return;
          setCollabToken(tokenData.token);
          setCanEdit(Boolean(tokenData.canEdit));
        }
      } catch {
        // Collaboration unreachable — BlockEditor falls back to degraded
        // (non-live-merge) mode on its own; canEdit stays false (safe default).
      }

      if (active) setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, [params.id]);

  async function publish() {
    setPublishing(true);
    await fetch(`/api/procedures/${params.id}/blocks/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary, changelog: "Modifica contenuto" }),
    });
    setPublishing(false);
    router.push(`/procedures/${params.id}`);
    router.refresh();
  }

  if (loading || blocks === null) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  const userId = (session?.user as any)?.id ?? "anon";
  const collabUser = { name: session?.user?.name ?? "Utente", color: colorForUser(userId) };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between opacity-0 animate-rise">
        <h1 className="font-display text-2xl font-semibold">Modifica procedura</h1>
        <button
          onClick={publish}
          disabled={publishing || !canEdit}
          className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {publishing ? "Pubblicazione…" : "Pubblica versione"}
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titolo procedura"
        disabled={!canEdit}
        className="w-full rounded-sm border border-border bg-background px-3 py-2 font-display text-xl outline-none focus:border-primary disabled:opacity-70 opacity-0 animate-rise"
        style={{ animationDelay: "60ms" }}
      />
      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Breve descrizione"
        disabled={!canEdit}
        className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:border-primary disabled:opacity-70 opacity-0 animate-rise"
        style={{ animationDelay: "120ms" }}
      />

      <div className="opacity-0 animate-rise" style={{ animationDelay: "180ms" }}>
        <BlockEditor
          parent={{ type: "procedure", id: params.id }}
          initialBlocks={blocks}
          editable={canEdit}
          collabToken={collabToken}
          user={collabUser}
        />
      </div>

      <p className="text-xs text-muted-foreground opacity-0 animate-rise" style={{ animationDelay: "240ms" }}>
        Ogni blocco si salva da solo mentre scrivi. &quot;Pubblica versione&quot; crea una nuova versione immutabile
        dall&apos;intero contenuto attuale — se la procedura era Pubblicata, torna in stato Draft finché non viene
        ri-approvata; la versione precedente resta visibile ai lettori fino ad allora.
      </p>
    </div>
  );
}
