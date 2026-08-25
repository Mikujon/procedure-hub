import { test, expect } from "@playwright/test";
import { createE2eFixture, type E2eFixture } from "./helpers/fixtures";
import { loginAsUi } from "./helpers/login";

/**
 * Real bug found while writing search-visibility.spec.ts, not in the code
 * that spec targets: the dashboard's own "Aggiornate di recente" widget
 * (app/(app)/dashboard/page.tsx) scanned every PUBLISHED procedure
 * tenant-wide with no visibility filtering at all — the exact same missing
 * lib/permissions check as GET /api/search had, just surfacing on the
 * homepage instead of a search result. A brand-new user with no department
 * membership would see a RESTRICTED procedure's title on their very first
 * dashboard load. Fixed alongside "In scadenza" and "Per il tuo ruolo"
 * (same query shape, same gap) by merging visibilityWhereClause into all
 * three, plus the dashboard's own favorites query and the underlying
 * POST/GET /api/favorites route (a user could otherwise favorite — and
 * permanently pin to their own dashboard — a procedure they couldn't view).
 */
test.describe("Dashboard 'recent' widget respects procedure visibility", () => {
  let fixture: E2eFixture;

  test.beforeAll(async () => {
    fixture = await createE2eFixture();
  });

  test.afterAll(async () => {
    await fixture.cleanup();
  });

  test("a department member sees the RESTRICTED procedure in 'Aggiornate di recente'", async ({ page }) => {
    await loginAsUi(page, fixture.member.email, fixture.password, fixture.tenant.slug);
    await expect(page.getByText("Aggiornate di recente")).toBeVisible();
    await expect(page.getByText(fixture.procedure.title)).toBeVisible();
  });

  test("a user outside the department never sees it on their dashboard", async ({ page }) => {
    await loginAsUi(page, fixture.outsider.email, fixture.password, fixture.tenant.slug);
    await expect(page.getByText("Aggiornate di recente")).toBeVisible();
    await expect(page.getByText(fixture.procedure.title)).not.toBeVisible();
  });
});
