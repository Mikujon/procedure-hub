"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ViewPrefs {
  fullWidth: boolean;
  smallText: boolean;
  setFullWidth: (v: boolean) => void;
  setSmallText: (v: boolean) => void;
}

const ViewPrefsContext = createContext<ViewPrefs | null>(null);

/** Read by PageOptionsMenu's "Larghezza intera"/"Testo piccolo" toggles — throws loudly rather than silently no-oping if ever rendered outside a ProcedureViewShell. */
export function useProcedureViewPrefs(): ViewPrefs {
  const ctx = useContext(ViewPrefsContext);
  if (!ctx) throw new Error("useProcedureViewPrefs must be used inside a ProcedureViewShell");
  return ctx;
}

const FULL_WIDTH_KEY = "phub:procedure-full-width";
const SMALL_TEXT_KEY = "phub:procedure-small-text";

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false; // private window / blocked storage — fall back to the default reading layout
  }
}

/**
 * Per-viewer reading preferences ("Larghezza intera" / "Testo piccolo" in
 * PageOptionsMenu) — a personal display setting like Notion's, not a
 * property of the procedure itself, so it lives in localStorage rather than
 * a schema field: no AuditLog entry, no effect on what other viewers see.
 * Wraps the whole procedure page body so both the layout (this component)
 * and the menu (rendered somewhere inside as a child) share one state
 * without prop-drilling it through the server component in between.
 */
export function ProcedureViewShell({ children }: { children: React.ReactNode }) {
  const [fullWidth, setFullWidthState] = useState(false);
  const [smallText, setSmallTextState] = useState(false);

  // Read the real preference only after mount — server-rendered markup has
  // no access to this browser's localStorage, so starting from the default
  // avoids a hydration mismatch; the brief flash to the stored preference
  // is the accepted tradeoff.
  useEffect(() => {
    setFullWidthState(readBool(FULL_WIDTH_KEY));
    setSmallTextState(readBool(SMALL_TEXT_KEY));
  }, []);

  const setFullWidth = (v: boolean) => {
    setFullWidthState(v);
    try {
      localStorage.setItem(FULL_WIDTH_KEY, v ? "1" : "0");
    } catch {
      // best-effort persistence only
    }
  };
  const setSmallText = (v: boolean) => {
    setSmallTextState(v);
    try {
      localStorage.setItem(SMALL_TEXT_KEY, v ? "1" : "0");
    } catch {
      // best-effort persistence only
    }
  };

  return (
    <ViewPrefsContext.Provider value={{ fullWidth, smallText, setFullWidth, setSmallText }}>
      <div
        className={cn(
          "mx-auto transition-[max-width] duration-200",
          fullWidth ? "max-w-7xl" : "max-w-5xl",
          smallText && "[&_.prose]:text-sm [&_.prose]:leading-relaxed"
        )}
      >
        {children}
      </div>
    </ViewPrefsContext.Provider>
  );
}
