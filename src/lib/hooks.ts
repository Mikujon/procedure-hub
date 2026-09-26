"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export interface BootstrapData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string | null;
    avatarColor: string;
    departmentId: string | null;
  } | null;
  tenant: { id: string; name: string; slug: string } | null;
  departments: any[];
  announcements: any[];
  stats: any;
}

export function useBootstrap() {
  const { status } = useSession();
  return useQuery<BootstrapData>({
    queryKey: ["bootstrap"],
    queryFn: () => fetchJson("/api/bootstrap"),
    enabled: status === "authenticated",
    retry: false,
  });
}

export function useProcedures(params: Record<string, string | undefined> = {}) {
  const { status } = useSession();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const key = qs.toString();
  return useQuery<any[]>({
    queryKey: ["procedures", key],
    queryFn: () => fetchJson(`/api/procedures?${key}`),
    enabled: status === "authenticated",
  });
}

export function useProcedure(id: string | null) {
  const { status } = useSession();
  return useQuery<any>({
    queryKey: ["procedure", id],
    queryFn: () => fetchJson(`/api/procedures/${id}`),
    enabled: !!id && status === "authenticated",
  });
}

export function useNotifications() {
  const { status } = useSession();
  return useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => fetchJson("/api/notifications"),
    enabled: status === "authenticated",
  });
}

export function useAuditLog(limit = 30) {
  const { status } = useSession();
  return useQuery<any[]>({
    queryKey: ["audit", limit],
    queryFn: () => fetchJson(`/api/audit?limit=${limit}`),
    enabled: status === "authenticated",
  });
}

export function useAck(procedureId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/procedures/${procedureId}/ack`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Ack failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      qc.invalidateQueries({ queryKey: ["procedures"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useToggleFavorite(procedureId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/procedures/${procedureId}/favorite`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Favorite failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      qc.invalidateQueries({ queryKey: ["procedures"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useTransition(procedureId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (target: string) => {
      const res = await fetch(`/api/procedures/${procedureId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Transition failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      qc.invalidateQueries({ queryKey: ["procedures"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useSaveContent(procedureId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      content: unknown[];
      title?: string;
      summary?: string;
      tags?: string[];
      criticality?: string;
      readMinutes?: number;
    }) => {
      const res = await fetch(`/api/procedures/${procedureId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Save failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure", procedureId] });
      qc.invalidateQueries({ queryKey: ["procedures"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}

// ---- KB hooks (Nodo contract) --------------------------------------------

export function useKbSearch(params: { q?: string; tipo?: string; obbligatorio?: string } = {}) {
  const { status } = useSession();
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.tipo) qs.set("tipo", params.tipo);
  if (params.obbligatorio) qs.set("obbligatorio", params.obbligatorio);
  const key = qs.toString();
  return useQuery<{ results: any[]; count: number }>({
    queryKey: ["kb-search", key],
    queryFn: () => fetchJson(`/api/kb/search?${key}`),
    enabled: status === "authenticated",
  });
}

export function useKbDocument(id: string | null) {
  const { status } = useSession();
  return useQuery<any>({
    queryKey: ["kb-document", id],
    queryFn: () => fetchJson(`/api/kb/document?id=${id}`).then((r) => r.document),
    enabled: !!id && status === "authenticated",
  });
}

export function useKbReadStatus(documentId: string | null, scope: "self" | "team" | "all" = "self") {
  const { status } = useSession();
  return useQuery<any>({
    queryKey: ["kb-read-status", documentId, scope],
    queryFn: () => fetchJson(`/api/kb/read-status?documentId=${documentId}&scope=${scope}`),
    enabled: !!documentId && status === "authenticated",
  });
}

export function useKbAck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, versionId, via, performedBy }: { documentId: string; versionId: string; via?: string; performedBy?: string }) => {
      const res = await fetch("/api/kb/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, versionId, via, performedBy }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Ack failed");
      }
      return res.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kb-document", vars.documentId] });
      qc.invalidateQueries({ queryKey: ["kb-search"] });
      qc.invalidateQueries({ queryKey: ["kb-read-status", vars.documentId] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useKbApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, decision, comment }: { documentId: string; decision: "approved" | "rejected"; comment?: string }) => {
      const res = await fetch("/api/kb/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, decision, comment }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Approve failed");
      }
      return res.json();
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["kb-document", vars.documentId] });
      qc.invalidateQueries({ queryKey: ["kb-search"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useKbPublish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/kb/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Publish failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-search"] });
      qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useKbRemind() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const res = await fetch("/api/kb/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Remind failed");
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kb-search"] });
    },
  });
}

export function useKbTree() {
  const { status } = useSession();
  return useQuery<any>({
    queryKey: ["kb-tree"],
    queryFn: () => fetchJson("/api/kb/tree"),
    enabled: status === "authenticated",
  });
}

// Compliance queue: documents awaiting compliance approval
export function useComplianceQueue() {
  const { data } = useKbSearch({});
  const docs = (data?.results ?? []).filter((d: any) => d.document.status === "in_review");
  return { data: docs, isLoading: false };
}

// ---- Admin hooks ---------------------------------------------------------

export function useAdminUsers() {
  const { status } = useSession();
  return useQuery<{ users: any[] }>({
    queryKey: ["admin-users"],
    queryFn: () => fetchJson("/api/kb/admin/users"),
    enabled: status === "authenticated",
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string; title?: string; location?: string; language?: string; avatarColor?: string }) => {
      const res = await fetch("/api/kb/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Create failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; role?: string; title?: string; location?: string; language?: string; active?: boolean; avatarColor?: string }) => {
      const res = await fetch(`/api/kb/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Update failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kb/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Delete failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useAdminOrgTree() {
  const { status } = useSession();
  return useQuery<{ tree: any[] }>({
    queryKey: ["admin-org-tree"],
    queryFn: () => fetchJson("/api/kb/admin/org-nodes"),
    enabled: status === "authenticated",
  });
}

export function useCreateOrgNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; name: string; code?: string; parentId?: string }) => {
      const res = await fetch("/api/kb/admin/org-nodes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Create failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-org-tree"] }),
  });
}

export function useUpdateOrgNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; code?: string; parentId?: string }) => {
      const res = await fetch(`/api/kb/admin/org-nodes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Update failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-org-tree"] }),
  });
}

export function useDeleteOrgNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kb/admin/org-nodes/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Delete failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-org-tree"] }),
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; nodeId: string; relation: string }) => {
      const res = await fetch("/api/kb/admin/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Assign failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-tree"] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/kb/admin/assignments/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Unassign failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-org-tree"] }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
}

export function useAdminDocTypes() {
  const { status } = useSession();
  return useQuery<{ configs: any[] }>({
    queryKey: ["admin-doc-types"],
    queryFn: () => fetchJson("/api/kb/admin/doc-types"),
    enabled: status === "authenticated",
  });
}

export function useUpdateDocType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { tipo: string; requiredApprovals: string[] }) => {
      const res = await fetch("/api/kb/admin/doc-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Update failed"); }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-doc-types"] }),
  });
}
