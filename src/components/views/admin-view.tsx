"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Users as UsersIcon,
  Network,
  Settings2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  UserPlus,
  ShieldCheck,
  Loader2,
  Mail,
  MapPin,
  Globe,
  Power,
} from "lucide-react";
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useAdminOrgTree,
  useCreateOrgNode,
  useUpdateOrgNode,
  useDeleteOrgNode,
  useCreateAssignment,
  useDeleteAssignment,
  useAdminDocTypes,
  useUpdateDocType,
} from "@/lib/hooks";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/domain";
import { UserAvatar } from "@/components/shared/user-avatar";

const ROLES = ["ADMIN", "COMPLIANCE", "HR_HEAD", "LEGAL_HEAD", "LEGAL_MANAGER", "TL", "FM", "CSDM", "COO", "VIEWER"];
const LOCATIONS = ["AL", "XK", "IT"];
const LANGUAGES = ["it", "sq", "en", "de"];
const NODE_TYPES = ["company", "branch", "function", "client", "campaign", "subcampaign", "team"];
const DOC_TIPOS = ["policy", "procedura", "processo", "comunicazione", "documento"];
const APPROVAL_ROLES = ["compliance", "quality", "training", "hr"];

export function AdminView() {
  const [tab, setTab] = React.useState<"users" | "org" | "types">("users");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Admin Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">Configura utenti, organigramma e tipi documento. Tutto da qui, niente codice.</p>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1.5 border-b border-border">
        {([
          { key: "users", label: "Utenti", icon: UsersIcon },
          { key: "org", label: "Organigramma", icon: Network },
          { key: "types", label: "Tipi documento", icon: Settings2 },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab />}
      {tab === "org" && <OrgTab />}
      {tab === "types" && <TypesTab />}
    </motion.div>
  );
}

// ---- Users tab ----------------------------------------------------------
function UsersTab() {
  const { data, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [showCreate, setShowCreate] = React.useState(false);

  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.length} utenti</p>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-105"
        >
          <UserPlus className="h-4 w-4" /> Nuovo utente
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl border border-border shimmer" />)}</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left font-semibold">Utente</th>
                <th className="px-4 py-2.5 text-left font-semibold">Ruolo</th>
                <th className="px-4 py-2.5 text-left font-semibold">Sede</th>
                <th className="px-4 py-2.5 text-left font-semibold">Lingua</th>
                <th className="px-4 py-2.5 text-center font-semibold">Attivo</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className={cn("border-b border-border/60 last:border-0 hover:bg-muted/20", !u.active && "opacity-50")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <UserAvatar name={u.name} color={u.avatarColor} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => { updateUser.mutate({ id: u.id, role: e.target.value }, { onSuccess: () => toast.success("Ruolo aggiornato"), onError: (e: any) => toast.error(e.message) }); }}
                      className="h-8 rounded-md border border-border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.location ?? ""}
                      onChange={(e) => updateUser.mutate({ id: u.id, location: e.target.value }, { onSuccess: () => toast.success("Sede aggiornata") })}
                      className="h-8 rounded-md border border-border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      <option value="">—</option>
                      {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.language}
                      onChange={(e) => updateUser.mutate({ id: u.id, language: e.target.value }, { onSuccess: () => toast.success("Lingua aggiornata") })}
                      className="h-8 rounded-md border border-border bg-card px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => updateUser.mutate({ id: u.id, active: !u.active }, { onSuccess: () => toast.success(u.active ? "Disattivato" : "Riattivato") })}
                      className={cn("inline-flex h-6 w-11 items-center rounded-full px-0.5 transition-colors", u.active ? "bg-status-published" : "bg-muted")}
                    >
                      <span className={cn("h-5 w-5 rounded-full bg-white shadow transition-transform", u.active && "translate-x-5")} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => { if (confirm(`Disattivare ${u.name}?`)) deleteUser.mutate(u.id, { onSuccess: () => toast.success("Utente disattivato") }); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser();
  const [form, setForm] = React.useState({ name: "", email: "", password: "", role: "VIEWER", title: "", location: "AL", language: "it", avatarColor: "#c2410c" });

  const submit = () => {
    if (!form.name || !form.email || !form.password) { toast.error("Nome, email e password sono obbligatori"); return; }
    createUser.mutate(form, {
      onSuccess: () => { toast.success("Utente creato"); onClose(); },
      onError: (e: any) => toast.error(e.message),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-lift)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-medium">Nuovo utente</h2>
        <div className="mt-4 space-y-3">
          <Field label="Nome"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" /></Field>
          <Field label="Password (temporanea)"><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ruolo">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm">
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </Field>
            <Field label="Titolo"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></Field>
            <Field label="Sede">
              <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm">
                {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Lingua">
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-2 text-sm">
                {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Colore avatar">
            <input type="color" value={form.avatarColor} onChange={(e) => setForm({ ...form, avatarColor: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted">Annulla</button>
          <button onClick={submit} disabled={createUser.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-105 disabled:opacity-60">
            {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Crea
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}

// ---- Organigramma tab ---------------------------------------------------
function OrgTab() {
  const { data, isLoading } = useAdminOrgTree();
  const createNode = useCreateOrgNode();
  const deleteNode = useDeleteOrgNode();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else { n.add(id); }
      return n;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Albero organigramma — drag-free, espandi/collassa i rami.</p>
        <button
          onClick={() => {
            const name = prompt("Nome del nuovo nodo radice:");
            if (name) createNode.mutate({ type: "company", name }, { onSuccess: () => toast.success("Nodo creato"), onError: (e: any) => toast.error(e.message) });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> Nodo radice
        </button>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl border border-border shimmer" />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          {(data?.tree ?? []).map((node: any) => (
            <OrgNodeRow key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgNodeRow({ node, depth, expanded, toggle }: { node: any; depth: number; expanded: Set<string>; toggle: (id: string) => void }) {
  const createNode = useCreateOrgNode();
  const updateNode = useUpdateOrgNode();
  const deleteNode = useDeleteOrgNode();
  const createAssignment = useCreateAssignment();
  const { data: usersData } = useAdminUsers();
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignUser, setAssignUser] = React.useState("");
  const [assignRel, setAssignRel] = React.useState("member");

  const isOpen = expanded.has(node.id);
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 20 }}>
        {hasChildren ? (
          <button onClick={() => toggle(node.id)} className="text-muted-foreground hover:text-foreground">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{node.type}</span>
        <span className="font-medium">{node.name}</span>
        {node.code && <span className="font-mono text-xs text-muted-foreground">({node.code})</span>}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => {
              const name = prompt("Nome del nuovo nodo figlio:");
              if (!name) return;
              const type = NODE_TYPES.includes(node.type) ? NODE_TYPES[NODE_TYPES.indexOf(node.type) + 1] ?? "team" : "team";
              createNode.mutate({ type, name, parentId: node.id }, { onSuccess: () => { toast.success("Nodo creato"); toggle(node.id); }, onError: (e: any) => toast.error(e.message) });
            }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
            title="Aggiungi figlio"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => { if (confirm(`Eliminare "${node.name}" e tutti i figli?`)) deleteNode.mutate(node.id, { onSuccess: () => toast.success("Nodo eliminato"), onError: (e: any) => toast.error(e.message) }); }}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
            title="Elimina"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setAssignOpen(!assignOpen)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
            title="Assegna utente"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {assignOpen && (
        <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: depth * 20 + 24 }}>
          <select value={assignUser} onChange={(e) => setAssignUser(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
            <option value="">Seleziona utente…</option>
            {(usersData?.users ?? []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
          <select value={assignRel} onChange={(e) => setAssignRel(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
            <option value="member">Membro</option>
            <option value="manager">Responsabile</option>
          </select>
          <button
            onClick={() => {
              if (!assignUser) return;
              createAssignment.mutate({ userId: assignUser, nodeId: node.id, relation: assignRel }, {
                onSuccess: () => { toast.success("Assegnazione creata"); setAssignOpen(false); setAssignUser(""); },
                onError: (e: any) => toast.error(e.message),
              });
            }}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
          >
            Assegna
          </button>
        </div>
      )}

      {isOpen && hasChildren && node.children.map((child: any) => (
        <OrgNodeRow key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} />
      ))}
    </div>
  );
}

// ---- Doc types tab ------------------------------------------------------
function TypesTab() {
  const { data, isLoading } = useAdminDocTypes();
  const updateType = useUpdateDocType();
  const [localConfigs, setLocalConfigs] = React.useState<Record<string, Set<string>>>({});

  React.useEffect(() => {
    if (data?.configs) {
      const m: Record<string, Set<string>> = {};
      for (const c of data.configs) {
        m[c.tipo] = new Set(c.requiredApprovals ?? []);
      }
      setLocalConfigs(m);
    }
  }, [data]);

  const toggle = (tipo: string, role: string) => {
    setLocalConfigs((prev) => {
      const s = new Set(prev[tipo] ?? []);
      if (s.has(role)) { s.delete(role); } else { s.add(role); }
      return { ...prev, [tipo]: s };
    });
  };

  const save = (tipo: string) => {
    const roles = Array.from(localConfigs[tipo] ?? []);
    updateType.mutate({ tipo, requiredApprovals: roles }, { onSuccess: () => toast.success(`Config "${tipo}" salvata`), onError: (e: any) => toast.error(e.message) });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Configura quali step di approvazione sono obbligatori per ogni tipo di documento. Domani aggiungi Quality, Training o HR senza toccare codice.</p>

      {isLoading ? (
        <div className="h-48 rounded-xl border border-border shimmer" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left font-semibold">Tipo documento</th>
                {APPROVAL_ROLES.map((r) => <th key={r} className="px-4 py-2.5 text-center font-semibold capitalize">{r}</th>)}
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {DOC_TIPOS.map((tipo) => (
                <tr key={tipo} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium capitalize">{tipo}</td>
                  {APPROVAL_ROLES.map((r) => (
                    <td key={r} className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggle(tipo, r)}
                        className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors", (localConfigs[tipo] ?? new Set()).has(r) ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent hover:border-foreground/30")}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => save(tipo)} disabled={updateType.isPending} className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-muted">
                      Salva
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
