import ExcelJS from "exceljs";
import type { ExportBlock } from "./content-blocks";

/**
 * Excel export is metadata + content-as-rows rather than a rendered
 * document — a Procedure isn't tabular data, but a spreadsheet is what
 * compliance/audit tooling typically wants to ingest (one row per block,
 * filterable/sortable), so that's the shape this produces instead of trying
 * to fake a page layout in cells.
 */

const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF2FF" } };
const LABEL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };

function blockLabel(block: ExportBlock): string {
  switch (block.type) {
    case "heading":
      return `Titolo ${block.level}`;
    case "paragraph":
      return "Paragrafo";
    case "quote":
      return "Citazione";
    case "code":
      return "Codice";
    case "divider":
      return "Divisore";
    case "image":
      return "Immagine";
    case "video":
      return "Video";
    case "listItem":
      return block.kind === "task" ? "Attività" : "Elemento lista";
    case "table":
      return "Tabella";
  }
}

function blockContent(block: ExportBlock): string {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "quote":
      return block.text;
    case "code":
      return block.text;
    case "divider":
      return "";
    case "image":
      return block.caption;
    case "video":
      return block.url;
    case "listItem": {
      const indent = "  ".repeat(block.depth);
      const bullet = block.kind === "task" ? (block.checked ? "[x]" : "[ ]") : block.kind === "ordered" ? `${block.index + 1}.` : "•";
      return `${indent}${bullet} ${block.text}`;
    }
    case "table":
      return block.rows.map((row) => row.join(" | ")).join("\n");
  }
}

export interface ProcedureExportInput {
  title: string;
  code: string;
  departmentName: string;
  status: string;
  summary: string | null;
  versionNumber: number;
  authorName: string;
  ownerName: string | null;
  tags: string[];
  reviewDate: Date | null;
  nextReviewDate: Date | null;
  blocks: ExportBlock[];
}

// Returns Node's global Buffer, not ExcelJS.Buffer — exceljs's .d.ts declares its
// own module-local `Buffer` (an ArrayBuffer alias, unrelated to Node's Buffer/
// Uint8Array), which isn't assignable where callers expect a real Buffer/Uint8Array.
export async function generateProcedureXlsx(input: ProcedureExportInput): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Procedure Hub";
  workbook.created = new Date();

  const details = workbook.addWorksheet("Dettagli");
  details.columns = [
    { header: "Campo", key: "field", width: 22 },
    { header: "Valore", key: "value", width: 70 },
  ];
  details.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  const detailRows: [string, string][] = [
    ["Titolo", input.title],
    ["Codice", input.code],
    ["Dipartimento", input.departmentName],
    ["Stato", input.status],
    ["Versione", `v${input.versionNumber}`],
    ["Autore", input.authorName],
    ["Owner", input.ownerName ?? "—"],
    ["Tag", input.tags.join(", ") || "—"],
    ["Sommario", input.summary ?? "—"],
    ["Ultima revisione", input.reviewDate ? input.reviewDate.toLocaleDateString("it-IT") : "—"],
    ["Prossima revisione", input.nextReviewDate ? input.nextReviewDate.toLocaleDateString("it-IT") : "—"],
  ];
  for (const [field, value] of detailRows) {
    const row = details.addRow({ field, value });
    row.getCell(1).font = { bold: true };
    row.getCell(1).fill = LABEL_FILL;
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
  }

  const content = workbook.addWorksheet("Contenuto");
  content.columns = [
    { header: "#", key: "index", width: 6 },
    { header: "Tipo", key: "type", width: 18 },
    { header: "Contenuto", key: "content", width: 90 },
  ];
  content.getRow(1).eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
  input.blocks.forEach((block, i) => {
    const row = content.addRow({ index: i + 1, type: blockLabel(block), content: blockContent(block) });
    row.getCell(3).alignment = { wrapText: true, vertical: "top" };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
