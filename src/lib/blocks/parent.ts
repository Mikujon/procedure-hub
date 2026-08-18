/**
 * A Procedure's content lives in one of two places: its own Block.procedureId
 * tree (the classic path, Fase 1), or — for a Procedure promoted from a free
 * Page (Fase 3) — the Block.pageId tree of the Page it's linked to, so
 * promotion never duplicates content. Every route that reads/writes a
 * procedure's blocks needs to resolve which one applies; this is the one
 * place that decision is made.
 */
export function blockParentWhere(procedure: { id: string; pageId: string | null }) {
  return procedure.pageId ? { pageId: procedure.pageId } : { procedureId: procedure.id };
}

export function blockParentCreateData(procedure: { id: string; pageId: string | null }) {
  return procedure.pageId
    ? { pageId: procedure.pageId, procedureId: null }
    : { procedureId: procedure.id, pageId: null };
}
