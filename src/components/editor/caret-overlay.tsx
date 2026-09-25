"use client";

import * as React from "react";
import type { RemoteCursor } from "@/lib/collab/client";

/**
 * Compute the pixel position of a caret at `offset` inside `el` (a textarea
 * or input), relative to el's parent. Uses the mirror-div technique: clone
 * the element's box + font styles into a hidden div, insert a span at the
 * offset, measure its position. Robust across text reflow / wrapping.
 */
function getCaretCoords(
  el: HTMLInputElement | HTMLTextAreaElement,
  offset: number
): { top: number; left: number; height: number } | null {
  const parent = el.parentElement;
  if (!parent) return null;

  const styles = window.getComputedStyle(el);
  const mirror = document.createElement("div");

  // copy the box + font properties that affect text layout
  const props: (keyof CSSStyleDeclaration)[] = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderStyle",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "textIndent",
    "whiteSpace",
    "wordBreak",
    "overflowWrap",
    "tabSize",
  ];
  for (const p of props) {
    mirror.style.setProperty(
      p as string,
      styles.getPropertyValue(p as string)
    );
  }

  mirror.style.position = "absolute";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.pointerEvents = "none";

  const value = (el as HTMLTextAreaElement).value ?? "";
  const clampedOffset = Math.max(0, Math.min(offset, value.length));

  mirror.textContent = value.substring(0, clampedOffset);
  const span = document.createElement("span");
  span.textContent = value.substring(clampedOffset) || "\u200b"; // zero-width space so empty caret has size
  mirror.appendChild(span);

  parent.appendChild(mirror);
  const top = span.offsetTop;
  const left = span.offsetLeft;
  const height = span.offsetHeight || parseInt(styles.lineHeight, 10) || 20;
  parent.removeChild(mirror);

  // account for the textarea's scroll (the mirror doesn't scroll)
  const scrollTop = (el as HTMLTextAreaElement).scrollTop || 0;
  const scrollLeft = (el as HTMLTextAreaElement).scrollLeft || 0;

  return { top: top - scrollTop, left: left - scrollLeft, height };
}

/**
 * CaretOverlay — renders a colored caret + name flag for each remote cursor
 * that targets the given blockIndex. Position is computed against the editable
 * element found inside `containerRef` (the first input/textarea).
 *
 * Recomputes on every render that changes the cursor data or the block text.
 * Cheap because there are typically 0–3 cursors per block.
 */
export function CaretOverlay({
  blockIndex,
  cursors,
  containerRef,
  blockText,
}: {
  blockIndex: number;
  cursors: RemoteCursor[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  blockText: string;
}) {
  const [coords, setCoords] = React.useState<
    Map<string, { top: number; left: number; height: number }>
  >(new Map());

  // recompute whenever cursors or text change
  React.useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const el = container.querySelector(
      "input, textarea"
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) {
      setCoords(new Map());
      return;
    }
    const next = new Map<
      string,
      { top: number; left: number; height: number }
    >();
    for (const c of cursors) {
      if (c.blockIndex !== blockIndex) continue;
      const pos = getCaretCoords(el, c.offset);
      if (pos) next.set(c.userId, pos);
    }
    setCoords(next);
  }, [cursors, blockIndex, blockText, containerRef]);

  // also recompute on resize (text reflow changes caret pixel position)
  React.useEffect(() => {
    const onResize = () => setCoords((prev) => new Map(prev)); // trigger re-render
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (coords.size === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
      {cursors
        .filter((c) => c.blockIndex === blockIndex && coords.has(c.userId))
        .map((c) => {
          const pos = coords.get(c.userId)!;
          return (
            <div
              key={c.userId}
              className="absolute transition-all duration-100 ease-out"
              style={{
                top: pos.top,
                left: pos.left,
                height: pos.height,
              }}
            >
              {/* the caret bar */}
              <span
                className="block w-0.5 h-full rounded-full animate-pulse"
                style={{ backgroundColor: c.color }}
              />
              {/* the name flag */}
              <span
                className="absolute -top-4 left-0 whitespace-nowrap rounded px-1 py-0.5 text-[9px] font-semibold leading-none text-white shadow-[var(--shadow-soft)]"
                style={{ backgroundColor: c.color }}
              >
                {c.name.split(" ")[0]}
              </span>
            </div>
          );
        })}
    </div>
  );
}
