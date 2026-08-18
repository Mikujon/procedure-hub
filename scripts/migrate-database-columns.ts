import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * One-time, manual migration: turns each Database's legacy
 * propertiesLegacy/viewsLegacy JSON arrays into real DatabaseColumn/
 * DatabaseView rows (Fase 2 — relational database engine). Preserves the
 * original property/view ids, so existing DatabaseRow.values (keyed by
 * property id) stay valid without needing to be rewritten.
 *
 * Idempotent: databases that already have DatabaseColumn rows are skipped.
 * Run manually: `npx tsx scripts/migrate-database-columns.ts`.
 */

interface LegacyOption {
  id: string;
  name: string;
  color: string;
}

interface LegacyProperty {
  id: string;
  name: string;
  type: "text" | "number" | "select" | "date" | "checkbox";
  options?: LegacyOption[];
}

interface LegacyView {
  id: string;
  name: string;
  type: "table" | "board";
  groupByPropertyId?: string;
}

const COLUMN_TYPE_MAP: Record<LegacyProperty["type"], "TEXT" | "NUMBER" | "SELECT" | "DATE" | "CHECKBOX"> = {
  text: "TEXT",
  number: "NUMBER",
  select: "SELECT",
  date: "DATE",
  checkbox: "CHECKBOX",
};

const VIEW_TYPE_MAP: Record<LegacyView["type"], "TABLE" | "BOARD"> = {
  table: "TABLE",
  board: "BOARD",
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function migrateDatabase(db: { id: string; title: string; propertiesLegacy: unknown; viewsLegacy: unknown }) {
  const existing = await prisma.databaseColumn.count({ where: { databaseId: db.id } });
  if (existing > 0) {
    console.log(`  skip "${db.title}" (${db.id}) — already has ${existing} columns`);
    return;
  }

  const properties = (Array.isArray(db.propertiesLegacy) ? db.propertiesLegacy : []) as unknown as LegacyProperty[];
  const views = (Array.isArray(db.viewsLegacy) ? db.viewsLegacy : []) as unknown as LegacyView[];

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i];
    await prisma.databaseColumn.create({
      data: {
        id: p.id,
        databaseId: db.id,
        name: p.name,
        type: COLUMN_TYPE_MAP[p.type] ?? "TEXT",
        sortOrder: i,
        config: toJson(p.type === "select" ? { options: p.options ?? [] } : {}),
      },
    });
  }

  for (const v of views) {
    await prisma.databaseView.create({
      data: {
        id: v.id,
        databaseId: db.id,
        name: v.name,
        type: VIEW_TYPE_MAP[v.type] ?? "TABLE",
        groupByColumnId: v.groupByPropertyId ?? null,
      },
    });
  }

  console.log(`  migrated "${db.title}" (${db.id}) — ${properties.length} columns, ${views.length} views`);
}

async function main() {
  const databases = await prisma.database.findMany({
    select: { id: true, title: true, propertiesLegacy: true, viewsLegacy: true },
  });

  console.log(`Found ${databases.length} databases.`);

  for (const db of databases) {
    await migrateDatabase(db);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
