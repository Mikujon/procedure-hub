"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Save,
  Loader2,
  Plus,
  X,
  Send,
  Globe,
  MapPin,
  Users as UsersIcon,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useKbDocument, useKbPublish, useKbTree, useBootstrap } from "@/lib/hooks";
import { toast } from "sonner";
import { BlockEditor } from "@/components/editor/block-editor";
import { cn } from "@/lib/utils";
import { roleLabel, can } from "@/lib/domain";
import type { Block } from "@/lib/types";

const TIPOS = [
  { value: "policy", label: "Policy", roles: ["LEGAL_HEAD", "ADMIN"] },
  { value: "procedura", label: "Procedura", roles: ["HR_HEAD", "ADMIN"] },
  { value: "processo", label: "Processo", roles: ["HR_HEAD", "ADMIN"] },
  { value: "comunicazione", label: "Comunicazione", roles: ["HR_HEAD", "ADMIN"] },
  { value: "documento", label: "Documento", roles: ["HR_HEAD", "ADMIN"] },
];

const LANGUAGES = [
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "sq", label: "Shqip", flag: "🇦🇱" },
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "de", label: "Deutsch", flag: "🇩🇪" },
];

const LOCATIONS = ["AL", "XK", "IT"];

export function KbEditorView() {
  const { selectedProcedureId, openProcedure, setView } = useAppStore();
  const { data: doc } = useKbDocument(selectedProcedureId);
  const { data: tree } = useKbTree();
  const { data: boot } = useBootstrap();
  const publish = useKbPublish();

  const role = boot?.user?.role ?? "VIEWER";
  const isNew = !selectedProcedureId;

  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [tipo, setTipo] = React.useState("procedura");
  const [category, setCategory] = React.useState("");
  const [obbligatorio, setObbligatorio] = React.useState(false);
  const [lingua, setLingua] = React.useState("it");
  const [blocks, setBlocks] = React.useState<Block[]>([]);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [selectedNodes, setSelectedNodes] = React.useState<Set<string>>(new Set());
  const [selectedSedi, setSelectedSedi] = React.useState<Set<string>>(new Set());
  const [selectedRuoli, setSelectedRuoli] = React.useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = React.useState(false);

  // hydrate from existing doc
  React.useEffect(() => {
    if (doc && !hydrated) {
      setTitle(doc.title);
      setSummary(doc.summary);
      setTipo(doc.tipo);
      setCategory(doc.category ?? "");
      setObbligatorio(doc.obbligatorio);
      setBlocks(doc.currentVersion?.testo ?? []);
      setTags(doc.tags ?? []);
      // load destinations
      if (doc.destinations[0]) {
        setSelectedNodes(new Set(doc.destinations[0].nodeIds));
        setSelectedSedi(new Set(doc.destinations[0].sedi));
        setSelectedRuoli(new Set(doc.destinations[0].ruoli));
      }
      setHydrated(true);
    } else if (isNew && !hydrated) {
      setHydrated(true);
    }
  }, [doc?.id, hydrated]);

  // available tipos for this role
  const availableTipos = TIPOS.filter((t) => t.roles.includes(role) || role === "ADMIN");

  const canPublishNow = (selectedNodes.size > 0 || selectedSedi.size > 0 || selectedRuoli.size > 0) && title.trim() && blocks.length > 0;

  const onPublish = (publishNow: boolean) => {
    if (!title.trim()) { toast.error("Titolo obbligatorio"); return; }
    if (blocks.length === 0) { toast.error("Il contenuto è vuoto"); return; }
    if (selectedNodes.size === 0 && selectedSedi.size === 0) {
      toast.warning("Nessuna destinazione", { description: "Il documento sarà visibile solo a te. Aggiungi nodi o sedi per renderlo visibile." });
    }

    publish.mutate(
      {
        documentId: selectedProcedureId ?? undefined,
        title, summary, tipo, category, obbligatorio,
        content: blocks, tags, lingua,
        destinations: {
          nodeIds: Array.from(selectedNodes),
          sedi: Array.from(selectedSedi),
          ruoli: Array.from(selectedRuoli),
          lingue: [],
        },
        publishNow,
      },
      {
        onSuccess: (res: any) => {
          if (res.published) {
            toast.success("Pubblicato", { description: "Nuova versione creata e in vigore." });
          } else {
            toast.success("Inviato per revisione", { description: `In attesa di approvazione: ${res.requiredApprovals?.join(", ") || "nessuna"}` });
          }
          if (res.documentId) openProcedure(res.documentId);
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  if (!hydrated) {
    return <div className="h-32 rounded-xl bg-muted/40 shimmer" />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        {/* toolbar */}
        <div className="sticky top-16 z-20 -mx-4 mb-4 flex items-center justify-between gap-2 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-2">
            <button onClick={() => selectedProcedureId ? openProcedure(selectedProcedureId) : setView("b7")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Indietro</span>
            </button>
            <span className="font-mono text-xs text-muted-foreground">{isNew ? "NUOVO" : doc?.code}</span>
            {isNew && <span className="text-[11px] text-primary font-medium">nuovo documento</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => selectedProcedureId && openProcedure(selectedProcedureId)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
              <Eye className="h-4 w-4" /><span className="hidden sm:inline">Anteprima</span>
            </button>
            <button onClick={() => onPublish(false)} disabled={publish.isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60">
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="hidden sm:inline">Invia per revisione</span>
            </button>
            <button onClick={() => onPublish(true)} disabled={publish.isPending || !canPublishNow} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground hover:brightness-105 disabled:opacity-60">
              <Save className="h-4 w-4" /> Pubblica
            </button>
          </div>
        </div>

        {/* title + summary */}
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo del documento…"
          className="font-display w-full rounded-lg border border-transparent bg-transparent text-3xl sm:text-4xl font-medium tracking-tight focus:border-border focus:bg-card focus:outline-none px-2 -mx-2"
        />
        <textarea
          value={summary} onChange={(e) => setSummary(e.target.value)}
          placeholder="Breve descrizione (una riga)…"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 text-[15px] text-muted-foreground focus:border-border focus:bg-card focus:outline-none"
        />

        {/* block editor */}
        <div className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
          <BlockEditor value={blocks} onChange={setBlocks} />
        </div>
      </div>

      {/* sidebar */}
      <aside className="lg:sticky lg:top-24 lg:self-start space-y-4">
        {/* tipo + lingua */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proprietà</p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Tipo documento</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm">
              {availableTipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Categoria</label>
            <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="es. Privacy, Safety, HR…" className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Lingua di pubblicazione</label>
            <div className="flex gap-1">
              {LANGUAGES.map((l) => (
                <button key={l.value} onClick={() => setLingua(l.value)}
                  className={cn("flex-1 rounded-md border px-2 py-1.5 text-sm transition-colors", lingua === l.value ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  <span className="mr-1">{l.flag}</span>{l.value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={obbligatorio} onChange={(e) => setObbligatorio(e.target.checked)} className="h-4 w-4 rounded border-border" />
            <span className="text-sm">Obbligatorio (richiede presa visione)</span>
          </label>
        </div>

        {/* destination picker */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Destinazione</p>
          <p className="text-[11px] text-muted-foreground">A quali nodi è destinato il documento? La cascata scende: chi sta sotto il nodo lo riceve.</p>
          <DestinationPicker
            tree={tree?.tree ?? []}
            selected={selectedNodes}
            onChange={setSelectedNodes}
          />
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium"><MapPin className="h-3 w-3" /> Filtra per sede</label>
            <div className="flex gap-1">
              {LOCATIONS.map((l) => (
                <button key={l} onClick={() => setSelectedSedi((prev) => { const n = new Set(prev); if (n.has(l)) { n.delete(l); } else { n.add(l); } return n; })}
                  className={cn("rounded-md border px-2 py-1 text-xs", selectedSedi.has(l) ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* tags */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tag</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t}<button onClick={() => setTags(tags.filter((x) => x !== t))} className="hover:text-foreground"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} placeholder="add tag" className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs" />
            <button onClick={addTag} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </aside>
    </motion.div>
  );
}

// ---- destination picker (collapsible tree with checkboxes) --------------
function DestinationPicker({ tree, selected, onChange }: { tree: any[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(tree.map((n: any) => n.id)));

  const toggle = (id: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  const toggleNode = (id: string) => onChange(new Set([...selected, id].filter((x, _, arr) => arr.includes(x) && (selected.has(id) ? x !== id : true))));

  return (
    <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-border p-2">
      {tree.length === 0 && <p className="text-xs text-muted-foreground py-2">Nessun nodo disponibile.</p>}
      {tree.map((node: any) => (
        <DestNode key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} selected={selected} onToggle={toggleNode} />
      ))}
    </div>
  );
}

function DestNode({ node, depth, expanded, toggle, selected, onToggle }: any) {
  const isOpen = expanded.has(node.id);
  const hasChildren = node.children?.length > 0;
  const isSelected = selected.has(node.id);

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1" style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button onClick={() => toggle(node.id)} className="text-muted-foreground">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : <span className="w-3.5" />}
        <button onClick={() => onToggle(node.id)} className="flex items-center gap-1.5 text-left">
          <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border", isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
            {isSelected && "✓"}
          </span>
          <span className="text-[10px] uppercase text-muted-foreground">{node.type}</span>
          <span className="text-sm">{node.name}</span>
        </button>
      </div>
      {isOpen && hasChildren && node.children.map((child: any) => (
        <DestNode key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} selected={selected} onToggle={onToggle} />
      ))}
    </div>
  );
}
