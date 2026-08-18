import { randomUUID } from "crypto";
import type { ColumnType, ViewType } from "@prisma/client";

export type PropertyType = "text" | "number" | "select" | "date" | "checkbox" | "relation";

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  options?: SelectOption[];
  /** RELATION only: which Database this column links rows to. */
  targetDatabaseId?: string;
}

export interface View {
  id: string;
  name: string;
  type: "table" | "board";
  groupByPropertyId?: string;
}

export const SELECT_COLORS = [
  "#DDE3EA", "#F3E1C7", "#D6E8D8", "#E7D6E8", "#F5D6D6", "#D6E7EC", "#EAE3C7",
];

const uid = () => randomUUID().slice(0, 8);

/** The schema a brand-new database starts with: a status + priority + due date. */
export function defaultSchema(): { properties: Property[]; views: View[] } {
  const status: Property = {
    id: uid(),
    name: "Stato",
    type: "select",
    options: [
      { id: uid(), name: "Da fare", color: SELECT_COLORS[0] },
      { id: uid(), name: "In corso", color: SELECT_COLORS[1] },
      { id: uid(), name: "Fatto", color: SELECT_COLORS[2] },
    ],
  };
  const priority: Property = {
    id: uid(),
    name: "Priorità",
    type: "select",
    options: [
      { id: uid(), name: "Bassa", color: SELECT_COLORS[3] },
      { id: uid(), name: "Media", color: SELECT_COLORS[4] },
      { id: uid(), name: "Alta", color: SELECT_COLORS[5] },
    ],
  };
  const due: Property = { id: uid(), name: "Scadenza", type: "date" };

  return {
    properties: [status, priority, due],
    views: [
      { id: uid(), name: "Tabella", type: "table" },
      { id: uid(), name: "Bacheca", type: "board", groupByPropertyId: status.id },
    ],
  };
}

export function newProperty(type: PropertyType, name: string): Property {
  const base: Property = { id: uid(), name, type };
  if (type === "select") {
    base.options = [
      { id: uid(), name: "Opzione 1", color: SELECT_COLORS[0] },
      { id: uid(), name: "Opzione 2", color: SELECT_COLORS[1] },
    ];
  }
  return base;
}

export function newOption(name: string, index: number): SelectOption {
  return { id: uid(), name, color: SELECT_COLORS[index % SELECT_COLORS.length] };
}

// ---------------------------------------------------------------------------
// Fase 2: mapping between the client-facing lowercase Property/View "type"
// strings (kept as-is so the frontend doesn't need to change) and the real
// Prisma ColumnType/ViewType enums the DB now uses.
// ---------------------------------------------------------------------------

const TO_COLUMN_TYPE: Record<PropertyType, ColumnType> = {
  text: "TEXT",
  number: "NUMBER",
  select: "SELECT",
  date: "DATE",
  checkbox: "CHECKBOX",
  relation: "RELATION",
};

const FROM_COLUMN_TYPE: Partial<Record<ColumnType, PropertyType>> = {
  TEXT: "text",
  NUMBER: "number",
  SELECT: "select",
  DATE: "date",
  CHECKBOX: "checkbox",
  RELATION: "relation",
};

export function toColumnType(type: PropertyType): ColumnType {
  return TO_COLUMN_TYPE[type];
}

/** Column types with no application logic yet (ROLLUP, FORMULA, ...) fall back to "text" for display rather than crashing. */
export function fromColumnType(type: ColumnType): PropertyType {
  return FROM_COLUMN_TYPE[type] ?? "text";
}

const TO_VIEW_TYPE: Record<View["type"], ViewType> = {
  table: "TABLE",
  board: "BOARD",
};

const FROM_VIEW_TYPE: Partial<Record<ViewType, View["type"]>> = {
  TABLE: "table",
  BOARD: "board",
};

export function toViewType(type: View["type"]): ViewType {
  return TO_VIEW_TYPE[type];
}

/** View types with no frontend renderer yet (CALENDAR, GALLERY, ...) fall back to "table". */
export function fromViewType(type: ViewType): View["type"] {
  return FROM_VIEW_TYPE[type] ?? "table";
}

/** Composes the Property[]/View[] shape the frontend expects from real DatabaseColumn/DatabaseView rows. */
export function columnsToProperties(
  columns: { id: string; name: string; type: ColumnType; config: unknown }[]
): Property[] {
  return columns.map((c) => {
    const config = (c.config ?? {}) as { options?: SelectOption[]; targetDatabaseId?: string };
    return {
      id: c.id,
      name: c.name,
      type: fromColumnType(c.type),
      options: config.options,
      targetDatabaseId: config.targetDatabaseId,
    };
  });
}

export function viewsToClient(
  views: { id: string; name: string; type: ViewType; groupByColumnId: string | null }[]
): View[] {
  return views.map((v) => ({
    id: v.id,
    name: v.name,
    type: fromViewType(v.type),
    groupByPropertyId: v.groupByColumnId ?? undefined,
  }));
}
