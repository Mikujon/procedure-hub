import { test, expect } from "@playwright/test";
import { createE2eFixture, type E2eFixture } from "./helpers/fixtures";
import { loginAsUi } from "./helpers/login";

/**
 * The login form (components/auth/login-form.tsx) is the one genuinely
 * UI-only surface in this app with no prior test coverage at all — the
 * Vitest suite tests auth.ts's authorize() logic indirectly through
 * lib/permissions, never the form itself.
 *
 * Uses its own scratch fixture rather than the seeded demo tenant's
 * admin@demo.com — login attempts (successful or not) count against
 * lib/rate-limit.ts's per-account/per-IP login limiter, and a long-lived
 * shared demo account re-used across many manual verification passes in
 * one session (or repeated CI runs) will eventually get rate-limited,
 * making a "wrong password" test pass for the wrong reason (rate-limit
 * denial, not the credentials check actually being exercised) — found by
 * hitting exactly that while developing this spec.
 */
test.describe("Login form", () => {
  let fixture: E2eFixture;

  test.beforeAll(async () => {
    fixture = await createE2eFixture();
  });

  test.afterAll(async () => {
    await fixture.cleanup();
  });

  test("logs in with valid credentials and reaches the dashboard", async ({ page }) => {
    await loginAsUi(page, fixture.member.email, fixture.password, fixture.tenant.slug);
    await expect(page.getByRole("heading", { name: /buongiorno/i })).toBeVisible();
  });

  test("shows an error and stays on the login page for a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Organizzazione").fill(fixture.tenant.slug);
    await page.getByLabel("Email").fill(fixture.member.email);
    await page.getByLabel("Password").fill("not-the-real-password");
    await page.getByRole("button", { name: "Accedi" }).click();

    await expect(page.getByText("Credenziali non valide.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows an error for a real email under a tenant slug it doesn't belong to", async ({ page }) => {
    // A tenantSlug/email combination that doesn't resolve must fail exactly
    // like a wrong password, not with a different error that hints the
    // tenant lookup itself is a separate, probeable step.
    await page.goto("/login");
    await page.getByLabel("Organizzazione").fill("not-a-real-tenant-slug");
    await page.getByLabel("Email").fill(fixture.member.email);
    await page.getByLabel("Password").fill(fixture.password);
    await page.getByRole("button", { name: "Accedi" }).click();

    await expect(page.getByText("Credenziali non valide.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});
