import { MeiliSearch } from "meilisearch";

/**
 * Search engine: MeiliSearch (self-hostable, typo-tolerant, sub-50ms at this
 * scale — a good fit for ~thousands of procedures across 200 users without
 * the ops overhead of Elasticsearch). One index per tenant keeps result sets
 * naturally isolated: index name is `procedures_{tenantId}`.
 *
 * Swap-in alternative: Algolia (managed, same API shape) if self-hosting
 * MeiliSearch is not desired — only this file would need to change.
 */

const client = new MeiliSearch({
  host: process.env.MEILISEARCH_HOST ?? "http://localhost:7700",
  apiKey: process.env.MEILISEARCH_API_KEY,
});

export function tenantIndex(tenantId: string) {
  return client.index(`procedures_${tenantId}`);
}

export async function ensureTenantIndex(tenantId: string) {
  const index = tenantIndex(tenantId);
  await index.updateSettings({
    searchableAttributes: ["title", "summary", "code", "contentText", "tags"],
    filterableAttributes: ["departmentId", "status", "type", "tags", "isCritical"],
    sortableAttributes: ["updatedAt"],
  });
  return index;
}

export interface SearchDocument {
  id: string;
  title: string;
  summary: string | null;
  code: string;
  contentText: string;
  departmentId: string;
  departmentName: string;
  status: string;
  type: string;
  tags: string[];
  isCritical: boolean;
  updatedAt: number; // epoch ms, for sorting
}

export async function indexProcedure(doc: SearchDocument, tenantId: string) {
  // ensureTenantIndex (not tenantIndex) so the first write to a tenant's
  // index also sets filterableAttributes — otherwise Meili auto-creates the
  // index with no filterable attributes, `status = PUBLISHED` throws on every
  // query, and callers silently fall back to Postgres forever for that tenant.
  const index = await ensureTenantIndex(tenantId);
  await index.addDocuments([doc], { primaryKey: "id" });
}

export async function removeFromIndex(procedureId: string, tenantId: string) {
  const index = tenantIndex(tenantId);
  await index.deleteDocument(procedureId);
}

/** Crude but sufficient for indexing: strips tags, collapses whitespace. Not for rendering. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds a SearchDocument from a Procedure row (with department + tags
 * loaded) plus a plain-text rendering of its content — callers supply the
 * text because the source differs by call site (Markdown from the block
 * tree when publishing via the block editor, stripped HTML for the legacy
 * single-document save path). Shared here so both call sites map the same
 * fields the same way instead of drifting apart.
 */
export function buildSearchDocument(
  procedure: {
    id: string;
    title: string;
    summary: string | null;
    code: string;
    departmentId: string;
    department: { name: string };
    status: string;
    type: string;
    isCritical: boolean;
    updatedAt: Date;
    tags: { tag: { name: string } }[];
  },
  contentText: string
): SearchDocument {
  return {
    id: procedure.id,
    title: procedure.title,
    summary: procedure.summary,
    code: procedure.code,
    contentText,
    departmentId: procedure.departmentId,
    departmentName: procedure.department.name,
    status: procedure.status,
    type: procedure.type,
    tags: procedure.tags.map((t) => t.tag.name),
    isCritical: procedure.isCritical,
    updatedAt: procedure.updatedAt.getTime(),
  };
}

/**
 * MeiliSearch's filter expressions are a string DSL, not a parameterized
 * query — a value dropped into `attr = "<value>"` unescaped lets whoever
 * controls that value break out of the quoted literal and append arbitrary
 * filter syntax of their own (e.g. `OR status = "DRAFT"`), the same class of
 * bug as string-built SQL. `departmentId`/`type`/each `tags` entry below all
 * come straight from a request query string (see api/search/route.ts), so
 * every value interpolated into a filter clause must go through this first.
 * Per Meili's filter syntax, a double-quoted string escapes `\` and `"` with
 * a leading backslash — the same escaping this needs, nothing Meili-specific
 * beyond that.
 */
export function escapeMeiliFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchProcedures(
  tenantId: string,
  query: string,
  filters: { departmentId?: string; type?: string; tags?: string[] } = {}
) {
  const index = tenantIndex(tenantId);
  const filterClauses: string[] = [`status = PUBLISHED`];
  if (filters.departmentId) filterClauses.push(`departmentId = "${escapeMeiliFilterValue(filters.departmentId)}"`);
  if (filters.type) filterClauses.push(`type = "${escapeMeiliFilterValue(filters.type)}"`);
  if (filters.tags?.length) {
    filterClauses.push(`(${filters.tags.map((t) => `tags = "${escapeMeiliFilterValue(t)}"`).join(" OR ")})`);
  }

  return index.search(query, {
    filter: filterClauses.join(" AND "),
    limit: 20,
    attributesToHighlight: ["title", "contentText"],
  });
}
