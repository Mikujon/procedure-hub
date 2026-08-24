import { PDFHexString, PDFName } from "pdf-lib";
import type { PDFDocument, PDFPage, PDFRef } from "pdf-lib";

/**
 * Real PDF navigation for the exported procedure — the "Bookmarks"/
 * "Outline" panel every PDF viewer has, plus clickable in-body links from
 * the exported TABLE_OF_CONTENTS block to the heading each entry names.
 *
 * pdf-lib (1.17.x) has no high-level API for either of these, so both are
 * built directly against its low-level PDFContext: every ref involved is
 * reserved upfront (context.nextRef()) so Parent/First/Last/Next/Prev can
 * all be resolved in a single pass instead of patching objects after the
 * fact once their neighbors exist.
 */

export interface OutlineEntryInput {
  title: string;
  level: 1 | 2 | 3;
  page: PDFPage;
  /** PDF y-coordinate (bottom-up) to land the entry's destination on — the writer's own position when the heading was drawn, not a viewport-relative offset. */
  y: number;
}

interface OutlineNode {
  ref: PDFRef;
  input: OutlineEntryInput;
  parent: OutlineNode | null;
  children: OutlineNode[];
}

function totalDescendants(node: OutlineNode): number {
  return node.children.reduce((sum, c) => sum + 1 + totalDescendants(c), 0);
}

/**
 * Adds one outline entry per heading, nested by level (an H2/H3 folds
 * under the nearest preceding shallower heading, same idea
 * lib/toc.ts's flat+indented list represents visually for the read view) —
 * each jumping straight to that heading's page and position. Also flips
 * PageMode to UseOutlines so a reader sees the panel open immediately
 * rather than having to know to look for it.
 */
export function addPdfOutline(pdf: PDFDocument, entries: OutlineEntryInput[]): void {
  if (entries.length === 0) return;
  const context = pdf.context;

  const nodes: OutlineNode[] = entries.map((input) => ({ ref: context.nextRef(), input, parent: null, children: [] }));

  // Stack of currently-open ancestors — same "nearest shallower level so
  // far" logic addPdfOutline's nesting needs, no different from any other
  // heading-level-to-tree walk.
  const stack: OutlineNode[] = [];
  const roots: OutlineNode[] = [];
  for (const node of nodes) {
    while (stack.length > 0 && stack[stack.length - 1].input.level >= node.input.level) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    node.parent = parent;
    (parent ? parent.children : roots).push(node);
    stack.push(node);
  }

  const outlinesRootRef = context.nextRef();

  function assignNode(node: OutlineNode, parentRef: PDFRef) {
    const siblings = node.parent ? node.parent.children : roots;
    const idx = siblings.indexOf(node);
    const prev = siblings[idx - 1];
    const next = siblings[idx + 1];
    const first = node.children[0];
    const last = node.children[node.children.length - 1];

    context.assign(
      node.ref,
      context.obj({
        Title: PDFHexString.fromText(node.input.title),
        Parent: parentRef,
        Dest: [node.input.page.ref, "XYZ", null, node.input.y, null],
        ...(prev ? { Prev: prev.ref } : {}),
        ...(next ? { Next: next.ref } : {}),
        ...(first ? { First: first.ref } : {}),
        ...(last ? { Last: last.ref } : {}),
        ...(node.children.length > 0 ? { Count: node.children.length + node.children.reduce((s, c) => s + totalDescendants(c), 0) } : {}),
      })
    );
    node.children.forEach((c) => assignNode(c, node.ref));
  }

  roots.forEach((r) => assignNode(r, outlinesRootRef));

  context.assign(
    outlinesRootRef,
    context.obj({
      Type: "Outlines",
      First: roots[0].ref,
      Last: roots[roots.length - 1].ref,
      Count: roots.length + roots.reduce((s, r) => s + totalDescendants(r), 0),
    })
  );

  pdf.catalog.set(PDFName.of("Outlines"), outlinesRootRef);
  pdf.catalog.set(PDFName.of("PageMode"), PDFName.of("UseOutlines"));
}

/** A single clickable rectangle on `sourcePage`, jumping to `destY` on `destPage` — used to make an exported TABLE_OF_CONTENTS block's entries real links to the heading each one names, not just look-alike text. */
export function addPdfInternalLink(
  pdf: PDFDocument,
  sourcePage: PDFPage,
  rect: [number, number, number, number],
  destPage: PDFPage,
  destY: number
): void {
  const annotRef = pdf.context.register(
    pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: rect,
      Border: [0, 0, 0],
      Dest: [destPage.ref, "XYZ", null, destY, null],
    })
  );
  sourcePage.node.addAnnot(annotRef);
}
