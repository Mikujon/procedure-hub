"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProcedureEditor } from "@/components/editor/procedure-editor";
import { FilePlus2 } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

const TYPES = [
  { value: "PROCEDURE", label: "Procedura" },
  { value: "WORK_INSTRUCTION", label: "Work Instruction" },
  { value: "POLICY", label: "Policy" },
  { value: "SOP", label: "SOP" },
  { value: "FORM", label: "Modulo" },
  { value: "TEMPLATE", label: "Template" },
  { value: "FAQ", label: "FAQ" },
] as const;

const VISIBILITY = [
  { value: "DEPARTMENT", label: "Dipartimento" },
  { value: "PUBLIC", label: "Pubblica (tutto il tenant)" },
  { value: "RESTRICTED", label: "Ristretta" },
] as const;

function codeFromTitle(title: string) {
  return title
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function NewProcedureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDept = searchParams.get("department") ?? "";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [departmentId, setDepartmentId] = useState(preselectedDept);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("PROCEDURE");
  const [visibility, setVisibility] = useState<(typeof VISIBILITY)[number]["value"]>("DEPARTMENT");
  const [summary, setSummary] = useState("");
  const [requiresAck, setRequiresAck] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [content, setContent] = useState<{ json: any; html: string }>({ json: null, html: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => {
        const list: Department[] = data.departments ?? [];
        setDepartments(list);
        if (!preselectedDept && list.length > 0) setDepartmentId(list[0].id);
      })
      .catch(() => setError("Impossibile caricare i dipartimenti."));
  }, [preselectedDept]);

  const effectiveCode = useMemo(
    () => (codeTouched ? code : codeFromTitle(title)),
    [code, codeTouched, title]
  );

  const canSubmit = title.trim().length >= 3 && effectiveCode.length >= 2 && departmentId && !saving;

  async function create() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/procedures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          code: effectiveCode,
          departmentId,
          type,
          visibility,
          summary: summary.trim() || undefined,
          requiresAck,
          isCritical,
          contentJson: content.json ?? { type: "doc", content: [] },
          contentHtml: content.html ?? "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setError("Non hai i permessi per creare procedure in questo dipartimento.");
        } else if (res.status === 409) {
          setError(
            (data as any)?.error ||
              `Il codice "${effectiveCode}" è già in uso. Modificalo e riprova.`
          );
          setCodeTouched(true);
        } else if (res.status === 400) {
          setError("Controlla i campi: titolo (min 3), codice (min 2) e dipartimento sono obbligatori.");
        } else {
          setError((data as any)?.error?.toString?.() || "Errore durante la creazione.");
        }
        setSaving(false);
        return;
      }

      const { procedure } = await res.json();
      router.push(`/procedures/${procedure.id}`);
      router.refresh();
    } catch {
      setError("Errore di rete durante la creazione.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Nuova</p>
          <h1 className="font-display text-2xl font-semibold">Crea procedura</h1>
        </div>
        <button
          onClick={create}
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <FilePlus2 className="h-4 w-4" /> {saving ? "Creazione…" : "Crea bozza"}
        </button>
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titolo procedura"
        className="w-full rounded-sm border border-border bg-background px-3 py-2 font-display text-xl outline-none focus:border-primary"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Codice procedura</span>
          <input
            value={effectiveCode}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value.toUpperCase());
            }}
            placeholder="ES. HR-ONBOARDING"
            className="w-full rounded-sm border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Dipartimento</span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {departments.length === 0 && <option value="">Nessun dipartimento</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Visibilità</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
            className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {VISIBILITY.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Breve descrizione"
        className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-muted-foreground outline-none focus:border-primary"
      />

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
          Richiede presa visione (Read &amp; Acknowledge)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
          Procedura critica
        </label>
      </div>

      <ProcedureEditor content={content.json} onChange={(json, html) => setContent({ json, html })} />

      <p className="text-xs text-muted-foreground">
        La procedura viene creata in stato <strong>Draft</strong>. Potrai inviarla in revisione dalla pagina di
        dettaglio una volta pronto il contenuto.
      </p>
    </div>
  );
}

export default function NewProcedurePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Caricamento…</p>}>
      <NewProcedureForm />
    </Suspense>
  );
}
