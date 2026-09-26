import { defineConfig } from "vitest/config";
import path from "path";
import "dotenv/config";

/**
 * Integration tests run against the real dev Postgres (docker compose), not
 * a mock — same "verify empirically" discipline as the rest of this repo's
 * manual verification passes, just automated and repeatable. Every test
 * suite creates its own isolated Tenant (see tests/helpers/test-tenant.ts)
 * and deletes it in afterAll, so this is safe to run against the shared dev
 * database without touching seeded demo data.
 *
 * External side effects that need infra this suite isn't testing (Slack/
 * Google Chat fan-out via BullMQ+Redis, MeiliSearch indexing) are mocked in
 * individual test files with vi.mock — see tests/setup.ts.
 */
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Scoped to tests/ explicitly — Vitest's default include glob
    // (**/*.{test,spec}.ts) would otherwise also pick up e2e/*.spec.ts,
    // Playwright's suite, which Playwright's own test.describe() rejects
    // when run under a different test runner.
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    // Real Postgres connections behind a shared singleton PrismaClient — keep
    // suites from stomping on each other's transactions/connections.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
