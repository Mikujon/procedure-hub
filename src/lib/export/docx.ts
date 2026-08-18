import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { ExportBlock } from "./content-blocks";

const HEADING_LEVEL: Record<1 | 2 | 3, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};

const MUTED = "64748B";
const CODE_BG = "F1F5F9";
const HEADER_BG = "EEF2FF";

function listBullet(block: Extract<ExportBlock, { type: "listItem" }>): string {
  if (block.kind === "task") return block.checked ? "☑" : "☐";
  if (block.kind === "ordered") return `${block.index + 1}.`;
  return "•";
}

function blockToParagraphs(block: ExportBlock): (Paragraph | Table)[] {
  switch (block.type) {
    case "heading":
      return [new Paragraph({ text: block.text, heading: HEADING_LEVEL[block.level], spacing: { before: 240, after: 120 } })];
    case "paragraph":
      return [new Paragraph({ text: block.text, spacing: { after: 160 } })];
    case "quote":
      return [
        new Paragraph({
          children: [new TextRun({ text: block.text, italics: true, color: MUTED })],
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "94A3B8", space: 8 } },
          spacing: { after: 160 },
        }),
      ];
    case "code": {
      const lines = block.text.split("\n");
      return lines.map(
        (line, i) =>
          new Paragraph({
            children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
            shading: { type: ShadingType.CLEAR, fill: CODE_BG },
            spacing: { after: i === lines.length - 1 ? 160 : 0 },
          })
      );
    }
    case "divider":
      return [
        new Paragraph({
          text: "",
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CBD5E1", space: 1 } },
          spacing: { after: 160 },
        }),
      ];
    case "image":
      return [
        new Paragraph({
          children: [new TextRun({ text: `[Immagine${block.caption ? `: ${block.caption}` : ""}]`, italics: true, color: MUTED })],
          spacing: { after: 160 },
        }),
      ];
    case "video":
      return [
        new Paragraph({
          children: [new TextRun({ text: `[Video: ${block.url}]`, italics: true, color: MUTED })],
          spacing: { after: 160 },
        }),
      ];
    case "listItem":
      return [
        new Paragraph({
          text: `${listBullet(block)}  ${block.text}`,
          indent: { left: 360 + block.depth * 360 },
          spacing: { after: 80 },
        }),
      ];
    case "table": {
      const rows = block.rows.map(
        (row, r) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph({ text: cell })],
                  shading: r === 0 ? { type: ShadingType.CLEAR, fill: HEADER_BG } : undefined,
                })
            ),
          })
      );
      return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })];
    }
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

export async function generateProcedureDocx(input: ProcedureExportInput): Promise<Buffer> {
  const header: Paragraph[] = [
    new Paragraph({ text: input.title, heading: HeadingLevel.TITLE, spacing: { after: 80 } }),
    new Paragraph({
      children: [new TextRun({ text: `${input.code} · ${input.departmentName} · v${input.versionNumber}`, color: MUTED, size: 20 })],
      spacing: { after: 160 },
    }),
  ];
  if (input.summary) {
    header.push(new Paragraph({ children: [new TextRun({ text: input.summary, italics: true, color: MUTED })], spacing: { after: 200 } }));
  }
  if (input.tags.length) {
    header.push(
      new Paragraph({
        children: [new TextRun({ text: input.tags.map((t) => `#${t}`).join("   "), size: 18, color: MUTED })],
        spacing: { after: 200 },
        alignment: AlignmentType.LEFT,
      })
    );
  }

  const body = input.blocks.flatMap(blockToParagraphs);

  const doc = new Document({
    creator: "Procedure Hub",
    title: `${input.code} — ${input.title}`,
    sections: [{ children: [...header, ...body] }],
  });

  return Packer.toBuffer(doc);
}
