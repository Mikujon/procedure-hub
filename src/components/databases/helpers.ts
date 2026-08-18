import { SELECT_COLORS, uid, type Property, type PropertyType } from "./types";

/** Client-safe property factory (mirrors lib/database.ts newProperty). */
export function newPropertyClient(type: PropertyType, name: string): Property {
  const p: Property = { id: uid(), name, type };
  if (type === "select") {
    p.options = [
      { id: uid(), name: "Opzione 1", color: SELECT_COLORS[0] },
      { id: uid(), name: "Opzione 2", color: SELECT_COLORS[1] },
    ];
  }
  return p;
}

export function formatCellValue(type: PropertyType, value: any): string {
  if (value === null || value === undefined || value === "") return "";
  if (type === "date") {
    try {
      return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(new Date(value));
    } catch {
      return String(value);
    }
  }
  return String(value);
}
