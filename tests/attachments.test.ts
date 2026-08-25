import { describe, it, expect } from "vitest";
import {
  ALLOWED_ATTACHMENT_EXTENSIONS,
  extensionOf,
  isAllowedAttachmentType,
  contentTypeForExtension,
  buildAttachmentStorageKey,
} from "@/lib/attachments";

describe("extensionOf", () => {
  it("returns the lowercased text after the last dot", () => {
    expect(extensionOf("report.PDF")).toBe("pdf");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
  });

  it("returns the whole string when there is no dot at all", () => {
    expect(extensionOf("noextension")).toBe("noextension");
  });

  it("returns an empty string for an empty fileName", () => {
    expect(extensionOf("")).toBe("");
  });

  it("does not resolve to a bare 'pdf' for a fileName smuggling a path after the real extension", () => {
    // Splitting on every "." in "../../" leaves "/etc/passwd" as the final
    // segment, not "pdf" — a whitelist exact-match on this "extension" must
    // fail either way, which is what isAllowedAttachmentType relies on.
    expect(extensionOf("evil.pdf/../../etc/passwd")).toBe("/etc/passwd");
  });
});

describe("isAllowedAttachmentType", () => {
  it("allows every extension on the documented whitelist, case-insensitively", () => {
    for (const ext of ALLOWED_ATTACHMENT_EXTENSIONS) {
      expect(isAllowedAttachmentType(`file.${ext}`)).toBe(true);
      expect(isAllowedAttachmentType(`file.${ext.toUpperCase()}`)).toBe(true);
    }
  });

  it("rejects an executable or script extension", () => {
    expect(isAllowedAttachmentType("installer.exe")).toBe(false);
    expect(isAllowedAttachmentType("script.sh")).toBe(false);
    expect(isAllowedAttachmentType("page.html")).toBe(false);
  });

  it("rejects a fileName with no extension", () => {
    expect(isAllowedAttachmentType("noextension")).toBe(false);
  });

  it("rejects a path-traversal-smuggling fileName even though it ends in an allowed extension's name", () => {
    // The real risk this guards: a fileName like "evil.pdf/../../etc/passwd"
    // must not be treated as a ".pdf" upload just because "pdf" appears in it.
    expect(isAllowedAttachmentType("evil.pdf/../../etc/passwd")).toBe(false);
  });
});

describe("contentTypeForExtension", () => {
  it("maps every allowed extension to a real, non-generic MIME type", () => {
    for (const ext of ALLOWED_ATTACHMENT_EXTENSIONS) {
      expect(contentTypeForExtension(ext)).not.toBe("application/octet-stream");
    }
  });

  it("falls back to application/octet-stream for an unrecognized extension", () => {
    expect(contentTypeForExtension("xyz")).toBe("application/octet-stream");
  });
});

describe("buildAttachmentStorageKey", () => {
  it("scopes the key under tenantId/procedureId and ends with the given extension", () => {
    const key = buildAttachmentStorageKey("tenant123", "proc456", "pdf");
    expect(key).toMatch(/^tenant123\/proc456\/[0-9a-f-]{36}\.pdf$/);
  });

  it("produces a different random key on every call, even for the same inputs", () => {
    const a = buildAttachmentStorageKey("t", "p", "pdf");
    const b = buildAttachmentStorageKey("t", "p", "pdf");
    expect(a).not.toBe(b);
  });
});
