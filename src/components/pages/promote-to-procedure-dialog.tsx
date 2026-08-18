"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

const TYPES = [
  { value: "PROCEDURE", label: "Procedura" },
  { value: "WORK_INSTRUCTION", label: "Istruzione di Lavoro" },
  { value: "POLICY", label: "Policy" },
  { value: "SOP", label: "SOP" },
  { value: "FORM", label: "Modulo" },
  { value: "FAQ", label: "FAQ" },
];

/** The form behind "Rendi Pagina Ufficiale" — the step that turns a free Page into a governed Documento Controllato. */
export function PromoteToProcedureDialog({
  pageId,
  onClose,
  onPromoted,
}: {
  pageId: string;
  onClose: () => void;
  onPromoted: (procedureId: string) => void;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("PROCEDURE");
  const [requiresAck, setRequiresAck] = useState(false);
  const [isCritical, setIsCritical] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => {
        setDepartments(d.departments ?? []);
        if (d.departments?.[0]) setDepartmentId(d.departments[0].id);
      });
  }, []);

  async function submit() {
    if (!departmentId || !code.trim()) {
      setError("Dipartimento e codice sono obbligatori.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/promote-to-procedure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId, code: code.trim(), type, requiresAck, isCritical }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Errore (${res.status})`);
      onPromoted(data.procedure.id);
    } catch (e: any) {
      setError(e.message ?? "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Rendi Pagina Ufficiale</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Trasforma questa pagina in un Documento Controllato: workflow di approvazione, versioning e Read &amp; Acknowledge.
          Il contenuto attuale resta esattamente com&apos;è, nessuna duplicazione.
        </p>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Dipartimento</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Codice</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="es. HR-PRO-014"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
              Richiede Read &amp; Ack
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={isCritical} onChange={(e) => setIsCritical(e.target.checked)} />
              Processo critico
            </label>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            Annulla
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Rendi Ufficiale
          </button>
        </div>
      </div>
    </div>
  );
}
