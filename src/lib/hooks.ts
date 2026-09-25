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
