import { describe, it, expect } from "vitest";
import { sanitizeIntegrationConfig, mergeIntegrationConfig, MASKED_SECRET_VALUE } from "@/lib/integrations/sanitize";

/**
 * Backs the new /admin/integrations page (found missing while explaining
 * to the user why #1-3 of the roadmap need real external credentials —
 * they expected a settings section their own company admin could fill in,
 * and GET/POST /api/admin/integrations existed but nothing rendered a form
 * for it, despite /admin/settings promising exactly that link).
 *
 * The real risk these two functions guard against: the admin UI pre-fills
 * secret fields with GET's masked placeholder (it never has the real
 * value to show) — saving a field the admin never touched must not
 * overwrite the real secret with the literal masked string.
 */
describe("sanitizeIntegrationConfig", () => {
  it("masks every key matching token/secret/key/password, case-insensitively", () => {
    const result = sanitizeIntegrationConfig({
      webhookUrl: "https://example.com/hook",
      botToken: "xoxb-real-token",
      signingSecret: "shh",
      clientSecret: "also-shh",
      apiKey: "shh-too",
      PASSWORD: "shh-uppercase",
    });
    expect(result.webhookUrl).toBe("https://example.com/hook"); // not secret-shaped by name
    expect(result.botToken).toBe(MASKED_SECRET_VALUE);
    expect(result.signingSecret).toBe(MASKED_SECRET_VALUE);
    expect(result.clientSecret).toBe(MASKED_SECRET_VALUE);
    expect(result.apiKey).toBe(MASKED_SECRET_VALUE);
    expect(result.PASSWORD).toBe(MASKED_SECRET_VALUE);
  });

  it("handles a null/undefined config without throwing", () => {
    expect(sanitizeIntegrationConfig(null)).toEqual({});
    expect(sanitizeIntegrationConfig(undefined)).toEqual({});
  });
});

describe("mergeIntegrationConfig", () => {
  it("overwrites a field with a genuinely new value", () => {
    const merged = mergeIntegrationConfig({ webhookUrl: "https://old.example.com" }, { webhookUrl: "https://new.example.com" });
    expect(merged.webhookUrl).toBe("https://new.example.com");
  });

  it("leaves the existing value untouched when the incoming value is exactly the mask placeholder", () => {
    const merged = mergeIntegrationConfig({ botToken: "xoxb-real-secret" }, { botToken: MASKED_SECRET_VALUE, webhookUrl: "https://x.example.com" });
    expect(merged.botToken).toBe("xoxb-real-secret"); // never overwritten with the placeholder
    expect(merged.webhookUrl).toBe("https://x.example.com"); // non-placeholder field still applied
  });

  it("sets an explicit empty string as a deliberate clear, distinct from the placeholder", () => {
    const merged = mergeIntegrationConfig({ botToken: "xoxb-real-secret" }, { botToken: "" });
    expect(merged.botToken).toBe("");
  });

  it("preserves fields not present in the incoming update at all (a mode switch doesn't wipe the other mode's fields)", () => {
    const merged = mergeIntegrationConfig(
      { mode: "bot", botToken: "xoxb-real-secret", signingSecret: "shh" },
      { mode: "webhook", webhookUrl: "https://x.example.com" }
    );
    expect(merged).toEqual({ mode: "webhook", webhookUrl: "https://x.example.com", botToken: "xoxb-real-secret", signingSecret: "shh" });
  });

  it("starts from an empty object when there is no existing config yet (first-time save)", () => {
    const merged = mergeIntegrationConfig(undefined, { mode: "webhook", webhookUrl: "https://x.example.com" });
    expect(merged).toEqual({ mode: "webhook", webhookUrl: "https://x.example.com" });
  });

  it("round-trips correctly through sanitize -> unchanged in the form -> merge (the real save-without-editing-secrets flow)", () => {
    const stored = { mode: "bot", botToken: "xoxb-real-secret", signingSecret: "shh" };
    const shownToAdmin = sanitizeIntegrationConfig(stored);
    // Admin changes nothing, submits the form exactly as pre-filled.
    const merged = mergeIntegrationConfig(stored, shownToAdmin);
    expect(merged).toEqual(stored);
  });
});
