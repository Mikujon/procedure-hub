"use client";

import { useState } from "react";
import { Loader2, X, Copy, Check } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

const GLOBAL_ROLES = [
  { value: "USER", label: "Utente" },
  { value: "COMPLIANCE_OFFICER", label: "Compliance Officer" },
  { value: "ADMIN", label: "Amministratore" },
];

const DEPARTMENT_ROLES = [
  { value: "VIEWER", label: "Viewer" },
  { value: "EDITOR", label: "Editor" },
  { value: "DEPARTMENT_OWNER", label: "Department Owner" },
];

/** Admin-only "Nuovo utente" form — the UI for POST /api/admin/users (SEC-05 / ADO-01 remediation). */
export function CreateUserDialog({
  departments,
  onClose,
  onCreated,
}: {
  departments: Department[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [globalRole, setGlobalRole] = useState("USER");
  const [departmentId, setDepartmentId] = useState("");
  const [departmentRole, setDepartmentRole] = useState("VIEWER");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim()) {
      setError("Nome ed email sono obbligatori.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          globalRole,
          departmentId: departmentId || undefined,
          departmentRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Errore (${res.status})`);
      setResult({ email: data.user.email, temporaryPassword: data.temporaryPassword });
    } catch (e: any) {
      setError(e.message ?? "Errore imprevisto");
    } finally {
      setSaving(false);
    }
  }

  function copyPassword() {
    if (!result) return;
    navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    if (result) onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-2xl">
        {result ? (
          <>
            <h2 className="mb-1 font-display text-lg font-semibold">Utente creato</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Comunica questa password temporanea a <strong>{result.email}</strong> fuori da questo canale. Non
              verrà mostrata di nuovo — al primo accesso dovrà sceglierne una nuova.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
              <span className="truncate">{result.temporaryPassword}</span>
              <button onClick={copyPassword} className="shrink-0 text-muted-foreground hover:text-foreground" type="button">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={handleClose}
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Fatto
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Nuovo utente</h2>
              <button onClick={onClose} type="button" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome Cognome"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@azienda.com"
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Ruolo globale</label>
                <select
                  value={globalRole}
                  onChange={(e) => setGlobalRole(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                >
                  {GLOBAL_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Dipartimento (opzionale)</label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">Nessuno</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Ruolo nel dipartimento</label>
                  <select
                    value={departmentRole}
                    onChange={(e) => setDepartmentRole(e.target.value)}
                    disabled={!departmentId}
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-50"
                  >
                    {DEPARTMENT_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} type="button" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
                Annulla
              </button>
              <button
                onClick={submit}
                type="button"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Crea utente
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
