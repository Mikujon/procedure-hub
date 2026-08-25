import { Page, expect } from "@playwright/test";

/**
 * Drives the real login form (components/auth/login-form.tsx) — no
 * shortcut through NextAuth's callback endpoint directly, since exercising
 * that actual form is part of what this suite exists to cover.
 */
export async function loginAsUi(page: Page, email: string, password: string, tenantSlug = "demo") {
  await page.goto("/login");
  await page.getByLabel("Organizzazione").fill(tenantSlug);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Accedi" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
