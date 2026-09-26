import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { ExportBlock } from "./content-blocks";
import { addPdfOutline, addPdfInternalLink, type OutlineEntryInput } from "./pdf-bookmarks";

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const INK: [number, number, number] = [0.08, 0.1, 0.18];
const MUTED: [number, number, number] = [0.42, 0.45, 0.52];
// Approximates the app's own --primary token (Control Room, HSL 186 78% 32%) — used only for the TOC block's real internal links, so they read as links rather than plain text.
const LINK_COLOR: [number, number, number] = [0.07, 0.51, 0.57];

/** Greedy word-wrap using the font's own metrics; falls back to a hard character break for single words wider than maxWidth (long URLs, unbroken code tokens). */
function wrapText(font: PDFFont, size: number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const ch of word) {
        const test = chunk + ch;
        if (font.widthOfTextAtSize(test, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = test;
        }
      }
      current = chunk;
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Page/cursor bookkeeping so callers can just say "draw this paragraph" without hand-tracking pagination. */
class PdfWriter {
  page: PDFPage;
  y: number;

  constructor(private pdf: PDFDocument) {
    this.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN_BOTTOM) {
      this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  gap(amount: number) {
    this.y -= amount;
  }

  paragraph(
    text: string,
    opts: { font: PDFFont; size: number; color?: [number, number, number]; indent?: number; gapAfter?: number }
  ) {
    const indent = opts.indent ?? 0;
    const maxWidth = CONTENT_WIDTH - indent;
    const lineHeight = opts.size * 1.4;
    const lines = wrapText(opts.font, opts.size, text, maxWidth);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN_X + indent,
        y: this.y,
        size: opts.size,
        font: opts.font,
        color: rgb(...(opts.color ?? INK)),
      });
      this.y -= lineHeight;
    }
    this.y -= opts.gapAfter ?? 0;
  }

  /**
   * Same shape as paragraph(), but for a heading specifically: returns
   * exactly where its first line landed (page + a y a touch above the
   * baseline, so a viewer jumping here doesn't land with the heading flush
   * against the very top edge) — generateProcedurePdf below records one of
   * these per heading for the outline/bookmarks panel and for the TOC
   * block's own links to resolve against.
   */
  headingParagraph(text: string, opts: { font: PDFFont; size: number; gapAfter?: number }): { page: PDFPage; y: number } {
    const lineHeight = opts.size * 1.4;
    this.ensureSpace(lineHeight);
    const destination = { page: this.page, y: this.y + lineHeight * 0.15 };
    const lines = wrapText(opts.font, opts.size, text, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, { x: MARGIN_X, y: this.y, size: opts.size, font: opts.font, color: rgb(...INK) });
      this.y -= lineHeight;
    }
    this.y -= opts.gapAfter ?? 0;
    return destination;
  }

  /**
   * Draws one (usually single-line) TOC block entry in the link color,
   * indented by heading level, and returns the page + bounding rect it
   * landed in — generateProcedurePdf attaches a real internal-link
   * annotation over that rect afterward, once every heading's own
   * destination is known (a TOC block normally sits *before* the headings
   * it lists, so those destinations aren't known yet at the point this runs).
   */
  tocEntry(text: string, opts: { font: PDFFont; size: number; indent: number }): { page: PDFPage; rect: [number, number, number, number] } {
    const maxWidth = CONTENT_WIDTH - opts.indent;
    const lineHeight = opts.size * 1.4;
    const lines = wrapText(opts.font, opts.size, text, maxWidth);
    this.ensureSpace(lineHeight * lines.length);
    const page = this.page;
    const top = this.y;
    let widest = 0;
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN_X + opts.indent, y: this.y, size: opts.size, font: opts.font, color: rgb(...LINK_COLOR) });
      widest = Math.max(widest, opts.font.widthOfTextAtSize(line, opts.size));
      this.y -= lineHeight;
    }
    const rect: [number, number, number, number] = [
      MARGIN_X + opts.indent,
      this.y,
      MARGIN_X + opts.indent + Math.max(widest, 10),
      top + opts.size * 0.25,
    ];
    this.y -= 3;
    return { page, rect };
  }

  divider() {
    this.ensureSpace(14);
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: this.y },
      thickness: 0.75,
      color: rgb(0.82, 0.82, 0.86),
    });
    this.y -= 14;
  }

  /**
   * Known limitation: a code block taller than one page is not split across
   * pages (the background rectangle is drawn as a single shape) — acceptable
   * for the procedure content this renders (short snippets), revisit if
   * multi-page code blocks turn out to matter in practice.
   */
  codeBlock(text: string, font: PDFFont) {
    const size = 9;
    const lineHeight = size * 1.4;
    const padding = 8;
    const lines = text.split("\n").flatMap((line) => wrapText(font, size, line || " ", CONTENT_WIDTH - padding * 2));
    const blockHeight = lines.length * lineHeight + padding * 2;
    this.ensureSpace(Math.min(blockHeight, PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM));
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: top - blockHeight,
      width: CONTENT_WIDTH,
      height: blockHeight,
      color: rgb(0.95, 0.95, 0.97),
    });
    let cy = top - padding - size;
    for (const line of lines) {
      this.page.drawText(line, { x: MARGIN_X + padding, y: cy, size, font, color: rgb(0.15, 0.15, 0.2) });
      cy -= lineHeight;
    }
    this.y = top - blockHeight - 8;
  }

  table(rows: string[][], fonts: { regular: PDFFont; bold: PDFFont }) {
    if (rows.length === 0) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const colWidth = CONTENT_WIDTH / cols;
    const size = 9;
    const padding = 4;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const isHeader = r === 0;
      const font = isHeader ? fonts.bold : fonts.regular;
      const cellLines = row.map((cell) => wrapText(font, size, cell || "", colWidth - padding * 2));
      const lineCount = Math.max(1, ...cellLines.map((l) => l.length));
      const rowHeight = lineCount * (size * 1.3) + padding * 2;
      this.ensureSpace(rowHeight);
      const top = this.y;
      if (isHeader) {
        this.page.drawRectangle({ x: MARGIN_X, y: top - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: rgb(0.93, 0.94, 0.98) });
      }
      for (let c = 0; c < cols; c++) {
        let cy = top - padding - size;
        for (const line of cellLines[c] ?? []) {
          this.page.drawText(line, { x: MARGIN_X + c * colWidth + padding, y: cy, size, font, color: rgb(...INK) });
          cy -= size * 1.3;
        }
      }
      this.page.drawLine({
        start: { x: MARGIN_X, y: top - rowHeight },
        end: { x: MARGIN_X + CONTENT_WIDTH, y: top - rowHeight },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.87),
      });
      this.y = top - rowHeight;
    }
    this.y -= 10;
  }
}

export interface ProcedureExportInput {
  title: string;
  code: string;
  departmentName: string;
  summary: string | null;
  versionNumber: number;
  tags: string[];
  blocks: ExportBlock[];
}

const HEADING_SIZE: Record<1 | 2 | 3, number> = { 1: 15, 2: 13, 3: 11.5 };

export async function generateProcedurePdf(input: ProcedureExportInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.code} — ${input.title}`);
  pdf.setProducer("Procedure Hub");
  pdf.setCreator("Procedure Hub");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  const w = new PdfWriter(pdf);

  w.paragraph(input.title, { font: bold, size: 18, gapAfter: 2 });
  w.paragraph(`${input.code} · ${input.departmentName} · v${input.versionNumber}`, { font: regular, size: 10, color: MUTED, gapAfter: 2 });
  if (input.summary) w.paragraph(input.summary, { font: italic, size: 10, color: MUTED, gapAfter: 4 });
  if (input.tags.length) w.paragraph(input.tags.map((t) => `#${t}`).join("   "), { font: regular, size: 9, color: MUTED, gapAfter: 4 });
  w.divider();
  w.gap(4);

  // Populated as headings/TOC entries are drawn, resolved into a real PDF
  // outline (bookmarks panel) and real internal links once the whole
  // document has been laid out — see the two calls after this loop.
  const headingDestinations: OutlineEntryInput[] = [];
  const pendingTocLinks: { page: PDFPage; rect: [number, number, number, number]; headingIndex: number }[] = [];

  for (const block of input.blocks) {
    switch (block.type) {
      case "heading": {
        w.gap(block.level === 1 ? 8 : 5);
        const dest = w.headingParagraph(block.text, { font: bold, size: HEADING_SIZE[block.level], gapAfter: 4 });
        headingDestinations.push({ title: block.text, level: block.level, page: dest.page, y: dest.y });
        break;
      }
      case "paragraph":
        w.paragraph(block.text, { font: regular, size: 10, gapAfter: 6 });
        break;
      case "quote":
        w.paragraph(block.text, { font: italic, size: 10, color: MUTED, indent: 16, gapAfter: 6 });
        break;
      case "code":
        w.codeBlock(block.text, mono);
        break;
      case "divider":
        w.divider();
        break;
      case "image":
        w.paragraph(`[Immagine${block.caption ? `: ${block.caption}` : ""}]`, { font: italic, size: 9, color: MUTED, gapAfter: 6 });
        break;
      case "video":
        w.paragraph(`[Video: ${block.url}]`, { font: italic, size: 9, color: MUTED, gapAfter: 6 });
        break;
      case "listItem": {
        const bullet = block.kind === "task" ? (block.checked ? "[x]" : "[ ]") : block.kind === "ordered" ? `${block.index + 1}.` : "•";
        w.paragraph(`${bullet}  ${block.text}`, { font: regular, size: 10, indent: 14 + block.depth * 14, gapAfter: 3 });
        break;
      }
      case "table":
        w.table(block.rows, { regular, bold });
        break;
      case "tocEntry": {
        const { page, rect } = w.tocEntry(block.text, { font: regular, size: 10, indent: 14 + (block.level - 1) * 14 });
        pendingTocLinks.push({ page, rect, headingIndex: block.headingIndex });
        break;
      }
    }
  }

  // Real PDF bookmarks (the viewer's own Outline/Bookmarks panel) for every
  // heading, regardless of whether the document has a TOC block at all —
  // and real clickable links from the TOC block's own entries to the
  // heading each one names, now that every heading's destination is known.
  addPdfOutline(pdf, headingDestinations);
  for (const link of pendingTocLinks) {
    const dest = headingDestinations[link.headingIndex];
    if (dest) addPdfInternalLink(pdf, link.page, link.rect, dest.page, dest.y);
  }

  return pdf.save();
}
