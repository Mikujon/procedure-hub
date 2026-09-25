"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface BootstrapData {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    title: string | null;
    avatarColor: string;
    departmentId: string | null;
  };
  departments: any[];
  announcements: any[];
  stats: any;
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useBootstrap() {
  return useQuery<BootstrapData>({
    queryKey: ["bootstrap"],
    queryFn: () => fetchJson("/api/bootstrap"),
  });
}

export function useProcedures(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }
  const key = qs.toString();
  return useQuery<any[]>({
    queryKey: ["procedures", key],
    queryFn: () => fetchJson(`/api/procedures?${key}`),
  });
}

export function useProcedure(id: string | null) {
  return useQuery<any>({
    queryKey: ["procedure", id],
    queryFn: () => fetchJson(`/api/procedures/${id}`),
    enabled: !!id,
  });
}

export function useNotifications() {
  return useQuery<any[]>({
    queryKey: ["notifications"],
    queryFn: () => fetchJson("/api/notifications"),
  });
}

export function useAuditLog(limit = 30) {
  return useQuery<any[]>({
    queryKey: ["audit", limit],
    queryFn: () => fetchJson(`/api/audit?limit=${limit}`),
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
