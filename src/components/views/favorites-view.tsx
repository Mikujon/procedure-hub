"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Star, ArrowRight } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useProcedures } from "@/lib/hooks";
import { ProcedureCard } from "@/components/procedure/procedure-card";
import { EmptyState } from "@/components/shared/layout-primitives";

export function FavoritesView() {
  const { openProcedure, setView } = useAppStore();
  const { data, isLoading } = useProcedures({ favorite: "1" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Favorites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Procedures you've pinned for quick access.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="h-3 w-1/3 rounded bg-muted shimmer" />
              <div className="h-4 w-2/3 rounded bg-muted shimmer" />
            </div>
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon={<Star className="h-5 w-5" />}
          title="No favorites yet"
          description="Star a procedure to pin it here for quick access. Your favorites also appear on your dashboard."
          action={
            <button
              onClick={() => setView("library")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:brightness-105 transition"
            >
              Browse the library <ArrowRight className="h-4 w-4" />
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((p: any) => (
            <ProcedureCard key={p.id} proc={p} onOpen={openProcedure} layout="grid" />
          ))}
        </div>
      )}
    </motion.div>
  );
}
