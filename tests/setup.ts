import { vi } from "vitest";

/**
 * Global mocks for infra this test suite deliberately does not exercise:
 *
 * - notifyEvent: fans out to Slack/Google Chat via a BullMQ queue (Redis).
 *   Not the object under test here — its Slack/GChat wiring was verified
 *   live earlier in the project. Mocked so workflow/automation tests don't
 *   depend on a worker process draining the queue.
 * - indexProcedure/removeFromIndex: real network calls to MeiliSearch.
 *   Mocked for the same reason; buildSearchDocument/stripHtml are pure and
 *   stay real via importActual so callers that use them still get a real
 *   SearchDocument shape.
 *
 * resolveDefaultRecipients is NOT mocked — lib/ack.ts and lib/integrations
 * /notify.ts's own real audience-resolution logic is worth exercising for
 * real against the DB.
 */
vi.mock("@/lib/integrations/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/notify")>();
  return {
    ...actual,
    notifyEvent: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/search")>();
  return {
    ...actual,
    indexProcedure: vi.fn().mockResolvedValue(undefined),
    removeFromIndex: vi.fn().mockResolvedValue(undefined),
    ensureTenantIndex: vi.fn().mockResolvedValue(undefined),
  };
});
