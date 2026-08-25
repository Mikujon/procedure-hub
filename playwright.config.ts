import { defineConfig, devices } from "@playwright/test";

/**
 * First real Playwright suite for this repo (roadmap item #6's last piece —
 * see CLAUDE.md). Scope is deliberately narrow for now: the login form (the
 * one genuinely UI-only surface with no existing coverage) and a real
 * regression guard for the search RBAC bug fixed earlier this session
 * (tests/permissions-search-visibility.test.ts covers filterVisibleProcedureHits
 * directly; this proves the same guarantee holds end-to-end through the
 * actual command palette a user drives). Not a rewrite of the Vitest
 * integration suite in browser form — most of this app's logic is already
 * covered there against the real DB; Playwright's job is the DOM/browser
 * behavior those tests can't see.
 *
 * `webServer` starts `npm run dev` itself and waits for it to answer, so
 * `npx playwright test` works standalone; `reuseExistingServer` skips that
 * when one's already running locally (this session's own dev server, or a
 * previous test run left one up).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // each spec creates/tears down its own scratch tenant — no shared state to race, but keep runs easy to reason about for now
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Next dev compiles each route on first hit — generous enough that a
  // cold first navigation after the webServer just started doesn't fail an
  // assertion that would otherwise be correct once warm.
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    // Only set in sandboxes with a pre-cached browser under a fixed path
    // that may not match this exact @playwright/test version's expected
    // cache dir (see the repo's own onboarding docs for that environment) —
    // unset everywhere else, so a normal machine/CI just uses Playwright's
    // own managed browser install.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
