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
  type: "table" | "board" | "gallery" | "calendar";
  groupByPropertyId?: string;
  /** CALENDAR only: which DATE property positions rows on the grid. */
  config?: { dateColumnId?: string };
}

export interface Row {
  id: string;
  title: string;
  values: Record<string, any>;
  sortOrder: number;
}

export interface Database {
  id: string;
  title: string;
  icon: string | null;
  properties: Property[];
  views: View[];
  rows: Row[];
}

export const SELECT_COLORS = [
  "#DDE3EA", "#F3E1C7", "#D6E8D8", "#E7D6E8", "#F5D6D6", "#D6E7EC", "#EAE3C7",
];

export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36)
  ).slice(0, 8);

export const PROPERTY_TYPE_LABEL: Record<PropertyType, string> = {
  text: "Testo",
  number: "Numero",
  select: "Selezione",
  date: "Data",
  checkbox: "Casella",
  relation: "Relazione",
};
