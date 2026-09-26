// GET /api/kb/search?q=&tipo=&obbligatorio=
// kb.search — returns documents VISIBLE to the caller (cascade + filters).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";
import { computeVisibleDocuments } from "@/lib/cascade";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId, tenantId } = ctx;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.toLowerCase();
  const tipo = url.searchParams.get("tipo");
  const obbligatorio = url.searchParams.get("obbligatorio");

  let docs = await computeVisibleDocuments(userId, tenantId);

  if (q) {
    docs = docs.filter((d) =>
      d.document.title.toLowerCase().includes(q) ||
      d.document.code.toLowerCase().includes(q) ||
      d.document.summary.toLowerCase().includes(q) ||
      d.document.tags.toLowerCase().includes(q)
    );
  }
  if (tipo) docs = docs.filter((d) => d.document.tipo === tipo);
  if (obbligatorio === "1") docs = docs.filter((d) => d.document.obbligatorio);
  if (obbligatorio === "0") docs = docs.filter((d) => !d.document.obbligatorio);

  return NextResponse.json({
    results: docs.map((d) => ({
      id: d.document.id,
      code: d.document.code,
      title: d.document.title,
      summary: d.document.summary,
      tipo: d.document.tipo,
      category: d.document.category,
      obbligatorio: d.document.obbligatorio,
      stato: d.document.stato,
      status: d.document.status,
      version: d.currentVersion ? d.currentVersion.numero : null,
      versionId: d.currentVersion?.id ?? null,
      lingua: d.currentVersion?.lingua ?? "it",
      acknowledged: d.acknowledged,
      acknowledgedAt: d.acknowledgedAt?.toISOString() ?? null,
      owner: d.document.owner,
      tags: safeParse(d.document.tags),
      updatedAt: d.document.updatedAt.toISOString(),
    })),
    count: docs.length,
  });
}

function safeParse(s: string | null): string[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
