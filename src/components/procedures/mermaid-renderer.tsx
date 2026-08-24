"use client";

import { useEffect } from "react";

/** Shared with DiagramBlock's own editor-side preview (block-renderer.tsx via media-blocks.tsx) — one mermaid.initialize() per browser tab, not one per rendered diagram. */
let mermaidInitDone = false;

/**
 * Hydrates every DIAGRAM block placeholder the current page's rendered
 * contentHtml contains (`<pre class="mermaid-source" data-mermaid-b64="…">`,
 * spliced in by lib/embedded-blocks.ts's injectDiagramPlaceholders) into a
 * real SVG diagram. contentHtml itself stays static markup — this renders
 * nothing of its own, it just walks the DOM after mount and replaces each
 * placeholder in place. Mount once per page that shows procedure content.
 */
export function MermaidRenderer() {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const nodes = document.querySelectorAll<HTMLElement>(".mermaid-source[data-mermaid-b64]");
      if (nodes.length === 0) return;

      const mermaid = (await import("mermaid")).default;
      if (!mermaidInitDone) {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "neutral" });
        mermaidInitDone = true;
      }

      for (let i = 0; i < nodes.length; i++) {
        if (cancelled) return;
        const node = nodes[i];
        const b64 = node.dataset.mermaidB64;
        if (!b64) continue;
        try {
          // Base64 -> raw bytes -> UTF-8 text, since serialize.ts encodes with
          // Buffer.from(code, "utf-8").toString("base64") server-side and a
          // Mermaid source can contain non-ASCII labels.
          const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
          const source = new TextDecoder("utf-8").decode(bytes);
          const { svg } = await mermaid.render(`mermaid-page-${i}-${Math.random().toString(36).slice(2, 8)}`, source);
          const container = document.createElement("div");
          container.className = "mermaid-diagram";
          container.innerHTML = svg;
          node.replaceWith(container);
        } catch {
          node.textContent = "Diagramma non valido.";
          node.classList.add("mermaid-source-error");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
