import { test, expect } from "@playwright/test";
import { createE2eFixture, type E2eFixture } from "./helpers/fixtures";
import { loginAsUi } from "./helpers/login";

/**
 * End-to-end regression guard for the RBAC bug fixed earlier this session:
 * GET /api/search returned hits with no visibility filtering at all, so any
 * authenticated tenant user could see a RESTRICTED procedure's title/code
 * regardless of department membership. filterVisibleProcedureHits
 * (tests/permissions-search-visibility.test.ts) already covers the fix at
 * the function level against the real DB — this proves the same guarantee
 * holds through the actual surface a person uses: the ⌘K command palette,
 * driven by a real browser, exercising the real GET /api/search route
 * end-to-end (not the fallback checked directly in isolation).
 */
test.describe("Command palette search respects procedure visibility", () => {
  let fixture: E2eFixture;

  test.beforeAll(async () => {
    fixture = await createE2eFixture();
  });

  test.afterAll(async () => {
    await fixture.cleanup();
  });

  test("a department member can find the RESTRICTED procedure", async ({ page }) => {
    await loginAsUi(page, fixture.member.email, fixture.password, fixture.tenant.slug);

    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Cerca procedure o naviga…").fill(fixture.procedure.code);

    await expect(page.getByText(fixture.procedure.title)).toBeVisible();
  });

  test("a user outside the department cannot find it, even knowing its exact code", async ({ page }) => {
    await loginAsUi(page, fixture.outsider.email, fixture.password, fixture.tenant.slug);

    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Cerca procedure o naviga…").fill(fixture.procedure.code);

    await expect(page.getByText("Nessun risultato")).toBeVisible();
    await expect(page.getByText(fixture.procedure.title)).not.toBeVisible();
  });
});
