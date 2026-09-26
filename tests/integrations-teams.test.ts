import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Integration } from "@prisma/client";
import { sendTeamsNotification } from "@/lib/integrations/teams";

/**
 * Unit tests for the Teams webhook adapter — network I/O (fetch) is what's
 * mocked here, unlike the DB-backed integration tests elsewhere in this
 * suite, since there's no real Teams Workflow webhook to POST to in CI/dev.
 * The payload shape itself (Adaptive Card wrapped in `attachments`) is
 * exactly what the code sends a real Teams Workflow webhook — verified
 * live against a local mock HTTP listener standing in for one, see the
 * plan doc for that run's details.
 */

function fakeIntegration(config: Record<string, any>, overrides: Partial<Integration> = {}): Integration {
  return {
    id: "int_1",
    tenantId: "tenant_1",
    type: "MICROSOFT_TEAMS",
    isEnabled: true,
    config,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Integration;
}

describe("sendTeamsNotification", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts an Adaptive Card message to the configured webhook URL", async () => {
    const integration = fakeIntegration({ mode: "webhook", webhookUrl: "https://example.com/teams-workflow" });
    await sendTeamsNotification({
      integration,
      userId: "user_1",
      title: "Procedura pubblicata",
      body: "La procedura X è stata pubblicata.",
      linkUrl: "/procedures/proc_1",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/teams-workflow");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const payload = JSON.parse(opts.body);
    expect(payload.type).toBe("message");
    const card = payload.attachments[0].content;
    expect(payload.attachments[0].contentType).toBe("application/vnd.microsoft.card.adaptive");
    expect(card.type).toBe("AdaptiveCard");
    expect(card.body[0]).toMatchObject({ type: "TextBlock", text: "Procedura pubblicata" });
    expect(card.body[1]).toMatchObject({ type: "TextBlock", text: "La procedura X è stata pubblicata." });
    expect(card.actions).toEqual([
      { type: "Action.OpenUrl", title: "Apri in Procedure Hub", url: expect.stringContaining("/procedures/proc_1") },
    ]);
  });

  it("includes a second Action.OpenUrl for the ack quick-confirm link when one is passed", async () => {
    const integration = fakeIntegration({ mode: "webhook", webhookUrl: "https://example.com/teams-workflow" });
    await sendTeamsNotification({
      integration,
      userId: "user_1",
      title: "Conferma lettura richiesta",
      linkUrl: "/procedures/proc_1",
      confirmUrl: "https://app.procedurehub.com/api/acknowledgments/quick-confirm?token=abc",
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const actions = payload.attachments[0].content.actions;
    expect(actions).toHaveLength(2);
    expect(actions[1]).toEqual({
      type: "Action.OpenUrl",
      title: "✓ Conferma lettura",
      url: "https://app.procedurehub.com/api/acknowledgments/quick-confirm?token=abc",
    });
  });

  it("omits the actions array entirely when there's no link and no confirm URL", async () => {
    const integration = fakeIntegration({ mode: "webhook", webhookUrl: "https://example.com/teams-workflow" });
    await sendTeamsNotification({ integration, userId: "user_1", title: "Solo un titolo" });

    const card = JSON.parse(fetchMock.mock.calls[0][1].body).attachments[0].content;
    expect(card.actions).toBeUndefined();
  });

  it("does not throw when the webhook POST itself rejects (network failure)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const integration = fakeIntegration({ mode: "webhook", webhookUrl: "https://example.com/teams-workflow" });
    await expect(sendTeamsNotification({ integration, userId: "user_1", title: "Titolo" })).resolves.toBeUndefined();
  });

  it("does not call fetch and does not throw when mode is 'bot' (not implemented yet)", async () => {
    const integration = fakeIntegration({ mode: "bot" });
    await expect(sendTeamsNotification({ integration, userId: "user_1", title: "Titolo" })).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch and does not throw when config is incomplete", async () => {
    const integration = fakeIntegration({ mode: "webhook" }); // no webhookUrl
    await expect(sendTeamsNotification({ integration, userId: "user_1", title: "Titolo" })).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
