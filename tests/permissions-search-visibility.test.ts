import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { filterVisibleProcedureHits } from "@/lib/permissions";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

/**
 * filterVisibleProcedureHits is the fix for a real gap found while adding
 * search test coverage: api/search/route.ts returned MeiliSearch/Postgres
 * hits with no visibility filtering at all — any authenticated tenant user
 * could see the title/summary/department of a DEPARTMENT- or
 * RESTRICTED-visibility procedure they had no membership grant for, and (on
 * the Meili path specifically) even a non-PUBLISHED one if the index's own
 * `status = PUBLISHED` filter clause could ever be bypassed (see
 * escapeMeiliFilterValue in lib/search.ts — a real, separate injection bug
 * in the same area, fixed alongside this one). api/ai/ask/route.ts already
 * had the right idea (post-filtering hits through visibilityWhereClause
 * before ever citing them in an answer) — this pulls that pattern out to a
 * shared helper both routes now use, with status re-checked too.
 */

let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

describe("filterVisibleProcedureHits", () => {
  it("keeps a PUBLIC published procedure visible to a user outside its department", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [proc.id]
    );
    expect(result.map((r) => r.id)).toEqual([proc.id]);
  });

  it("drops a DEPARTMENT-visibility procedure for a user with no membership in that department", async () => {
    const proc = await t.createProcedure({ visibility: "DEPARTMENT", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [proc.id]
    );
    expect(result).toEqual([]);
  });

  it("drops a RESTRICTED-visibility procedure for a user with no membership, same as DEPARTMENT", async () => {
    const proc = await t.createProcedure({ visibility: "RESTRICTED", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [proc.id]
    );
    expect(result).toEqual([]);
  });

  it("keeps a RESTRICTED procedure visible to a member of that department (e.g. a VIEWER)", async () => {
    const proc = await t.createProcedure({ visibility: "RESTRICTED", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.viewer.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [proc.id]
    );
    expect(result.map((r) => r.id)).toEqual([proc.id]);
  });

  it("lets an ADMIN see a RESTRICTED procedure regardless of department membership", async () => {
    const proc = await t.createProcedure({ visibility: "RESTRICTED", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "ADMIN" },
      t.tenant.id,
      [proc.id]
    );
    expect(result.map((r) => r.id)).toEqual([proc.id]);
  });

  it("drops a DRAFT procedure even for a user who could otherwise see it (status re-checked, not just visibility)", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "DRAFT" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [proc.id]
    );
    expect(result).toEqual([]);
  });

  it("preserves the input hitIds order (search-engine relevance), not insertion/query order", async () => {
    const a = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    const b = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    const c = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [c.id, a.id, b.id]
    );
    expect(result.map((r) => r.id)).toEqual([c.id, a.id, b.id]);
  });

  it("silently drops an id that doesn't exist (or belongs to another tenant) rather than throwing", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      [proc.id, "nonexistent-id"]
    );
    expect(result.map((r) => r.id)).toEqual([proc.id]);
  });

  it("returns an empty array immediately for an empty hitIds list, without querying", async () => {
    const result = await filterVisibleProcedureHits(
      { id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" },
      t.tenant.id,
      []
    );
    expect(result).toEqual([]);
  });
});
