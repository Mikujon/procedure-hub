"use client";

import { create } from "zustand";
import type { ViewKey } from "@/lib/types";

interface AppState {
  view: ViewKey;
  selectedProcedureId: string | null;
  commandOpen: boolean;
  notificationsOpen: boolean;
  mobileNavOpen: boolean;
  // library filters
  departmentFilter: string | null;
  statusFilter: string | null;
  searchQuery: string;
  // actions
  setView: (view: ViewKey) => void;
  openProcedure: (id: string) => void;
  openDocument: (id: string) => void;
  editProcedure: (id: string) => void;
  setCommandOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setDepartmentFilter: (id: string | null) => void;
  setStatusFilter: (status: string | null) => void;
  setSearchQuery: (q: string) => void;
  goHome: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  selectedProcedureId: null,
  commandOpen: false,
  notificationsOpen: false,
  mobileNavOpen: false,
  departmentFilter: null,
  statusFilter: null,
  searchQuery: "",
  setView: (view) => set({ view, mobileNavOpen: false }),
  openProcedure: (id) => set({ view: "document", selectedProcedureId: id, mobileNavOpen: false }),
  openDocument: (id) => set({ view: "document", selectedProcedureId: id, mobileNavOpen: false }),
  editProcedure: (id) => set({ view: "editor", selectedProcedureId: id, mobileNavOpen: false }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setDepartmentFilter: (departmentFilter) => set({ departmentFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  goHome: () => set({ view: "dashboard", selectedProcedureId: null, mobileNavOpen: false }),
}));
