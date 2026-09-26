"use client";

import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ScrollText, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useBootstrap } from "@/lib/hooks";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Footer } from "@/components/shell/footer";
import { CommandPalette } from "@/components/shell/command-palette";
import { LoginView } from "@/components/views/login-view";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DashboardView } from "@/components/views/dashboard-view";
import { B7View } from "@/components/views/nodo/b7-view";
import { KbDocumentView } from "@/components/views/nodo/kb-document-view";
import { ComplianceQueueView, Lg2View, Hr8View, Lg4View } from "@/components/views/nodo/role-views";
import { AdminView } from "@/components/views/admin-view";

export function AppShell() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
            <ScrollText className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return <LoginView />;
  return <Workspace />;
}

function Workspace() {
  const { view, mobileNavOpen, setMobileNavOpen } = useAppStore();
  const { isError } = useBootstrap();

  React.useEffect(() => {
    let lastKey: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "g") {
        lastKey = "g";
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => (lastKey = null), 800);
        return;
      }
      if (lastKey === "g") {
        const map: Record<string, () => void> = {
          d: () => useAppStore.getState().setView("dashboard"),
          b: () => useAppStore.getState().setView("b7"),
          c: () => useAppStore.getState().setView("compliance"),
          h: () => useAppStore.getState().setView("hr8"),
          l: () => useAppStore.getState().setView("lg2"),
          p: () => useAppStore.getState().setView("lg4"),
        };
        map[e.key.toLowerCase()]?.();
        lastKey = null;
        if (timer) clearTimeout(timer);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border">
          <Sidebar />
        </div>
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {isError && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Couldn&apos;t load workspace data. Retrying…</p>
                </div>
              )}
              <AnimatePresence mode="wait">
                <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  {view === "dashboard" && <DashboardView />}
                  {view === "b7" && <B7View />}
                  {view === "document" && <KbDocumentView />}
                  {view === "compliance" && <ComplianceQueueView />}
                  {view === "hr8" && <Hr8View />}
                  {view === "lg2" && <Lg2View />}
                  {view === "lg4" && <Lg4View />}
                  {view === "admin" && <AdminView />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
          <Footer />
        </div>
      </div>
      <CommandPalette />
    </div>
  );
}
