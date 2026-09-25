"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { useBootstrap } from "@/lib/hooks";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { Footer } from "@/components/shell/footer";
import { CommandPalette } from "@/components/shell/command-palette";
import { DashboardView } from "@/components/views/dashboard-view";
import { LibraryView } from "@/components/views/library-view";
import { ProcedureDetailView } from "@/components/views/procedure-detail-view";
import { ApprovalsView } from "@/components/views/approvals-view";
import { AdminView } from "@/components/views/admin-view";
import { FavoritesView } from "@/components/views/favorites-view";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

export function AppShell() {
  const { view, mobileNavOpen, setMobileNavOpen } = useAppStore();
  const { isLoading, isError } = useBootstrap();

  // Keyboard navigation: g then letter
  React.useEffect(() => {
    let lastKey: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
        return;
      if (e.key === "g") {
        lastKey = "g";
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => (lastKey = null), 800);
        return;
      }
      if (lastKey === "g") {
        const map: Record<string, () => void> = {
          d: () => useAppStore.getState().setView("dashboard"),
          l: () => useAppStore.getState().setView("library"),
          a: () => useAppStore.getState().setView("approvals"),
          f: () => useAppStore.getState().setView("favorites"),
          m: () => useAppStore.getState().setView("admin"),
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
        {/* Desktop sidebar */}
        <div className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border">
          <Sidebar />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <Sidebar />
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              {isError ? (
                <ErrorState />
              ) : isLoading && view === "dashboard" ? null : null}
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {view === "dashboard" && <DashboardView />}
                  {view === "library" && <LibraryView />}
                  {view === "procedure" && <ProcedureDetailView />}
                  {view === "approvals" && <ApprovalsView />}
                  {view === "admin" && <AdminView />}
                  {view === "favorites" && <FavoritesView />}
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

function ErrorState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load workspace data. Retrying…
      </p>
    </div>
  );
}
