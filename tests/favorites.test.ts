import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { toggleFavorite, listVisibleFavorites } from "@/lib/favorites";
import { createTestTenant, type TestTenant } from "./helpers/test-tenant";

/**
 * Real bug found while writing e2e/dashboard-visibility.spec.ts (not this
 * file's own subject): POST /api/favorites only checked tenant isolation,
 * never canViewProcedure — a user could favorite a DEPARTMENT/RESTRICTED
 * procedure they had no membership grant for, turning it into a permanent
 * reference shown (title, department) on their own dashboard/favorites
 * list. Same missing-visibility-check class as the GET /api/search and
 * dashboard "recent" bugs fixed earlier the same session, just on the
 * write path instead of a read path.
 */
let t: TestTenant;

beforeAll(async () => {
  t = await createTestTenant();
});

afterAll(async () => {
  await t.cleanup();
});

describe("toggleFavorite", () => {
  it("lets a user favorite a PUBLIC procedure they can view", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    const result = await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "ok", favorited: true });

    const row = await prisma.favorite.findUnique({ where: { userId_procedureId: { userId: t.outsider.id, procedureId: proc.id } } });
    expect(row).not.toBeNull();
  });

  it("refuses to create a favorite for a RESTRICTED procedure the user has no membership grant for", async () => {
    const proc = await t.createProcedure({ visibility: "RESTRICTED", status: "PUBLISHED" });
    const result = await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "forbidden" });

    const row = await prisma.favorite.findUnique({ where: { userId_procedureId: { userId: t.outsider.id, procedureId: proc.id } } });
    expect(row).toBeNull();
  });

  it("refuses a DEPARTMENT procedure the same way", async () => {
    const proc = await t.createProcedure({ visibility: "DEPARTMENT", status: "PUBLISHED" });
    const result = await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "forbidden" });
  });

  it("lets a department member favorite a RESTRICTED procedure in their own department", async () => {
    const proc = await t.createProcedure({ visibility: "RESTRICTED", status: "PUBLISHED" });
    const result = await toggleFavorite({ id: t.viewer.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "ok", favorited: true });
  });

  it("lets an ADMIN favorite a RESTRICTED procedure regardless of membership", async () => {
    const proc = await t.createProcedure({ visibility: "RESTRICTED", status: "PUBLISHED" });
    const result = await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "ADMIN" }, proc.id);
    expect(result).toEqual({ status: "ok", favorited: true });
  });

  it("always allows un-favoriting, even for a procedure the user can no longer view", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);

    // Visibility tightened after the fact — removing the now-stale
    // favorite must still succeed, unlike creating a new one would.
    await prisma.procedure.update({ where: { id: proc.id }, data: { visibility: "RESTRICTED" } });

    const result = await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
    expect(result).toEqual({ status: "ok", favorited: false });
    const row = await prisma.favorite.findUnique({ where: { userId_procedureId: { userId: t.outsider.id, procedureId: proc.id } } });
    expect(row).toBeNull();
  });

  it("returns not_found for a procedure id in another tenant", async () => {
    const other = await createTestTenant();
    try {
      const proc = await other.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
      const result = await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);
      expect(result).toEqual({ status: "not_found" });
    } finally {
      await other.cleanup();
    }
  });
});

describe("listVisibleFavorites", () => {
  it("omits a favorite whose procedure's visibility was tightened after the fact (defense in depth)", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);

    await prisma.procedure.update({ where: { id: proc.id }, data: { visibility: "RESTRICTED" } });

    const favorites = await listVisibleFavorites({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" });
    expect(favorites.some((f) => f.procedureId === proc.id)).toBe(false);

    await prisma.favorite.deleteMany({ where: { userId: t.outsider.id, procedureId: proc.id } });
  });

  it("includes a favorite the user can still view", async () => {
    const proc = await t.createProcedure({ visibility: "PUBLIC", status: "PUBLISHED" });
    await toggleFavorite({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" }, proc.id);

    const favorites = await listVisibleFavorites({ id: t.outsider.id, tenantId: t.tenant.id, globalRole: "USER" });
    expect(favorites.some((f) => f.procedureId === proc.id)).toBe(true);
  });
});
