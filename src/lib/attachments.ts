import { randomUUID } from "crypto";

/**
 * Shared, pure validation/naming logic for Attachment uploads — pulled out
 * of api/attachments/route.ts so it's testable without a request/session/S3
 * client in the loop (the route itself stays the thin glue: auth, Prisma,
 * storage). Matches the fileType comment on the Attachment model in
 * schema.prisma.
 */
export const ALLOWED_ATTACHMENT_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "png", "jpg", "jpeg", "mp4", "zip", "txt", "csv"];
export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/** Lowercased text after the last `.` in fileName — "" for a name with no extension at all. */
export function extensionOf(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Whitelist check, not a blacklist — deliberately rejects anything not in
 * ALLOWED_ATTACHMENT_EXTENSIONS, including a fileName crafted to smuggle a
 * path-traversal-looking string into what should be a plain extension
 * (e.g. "evil.pdf/../../etc/passwd" extracts to "pdf/../../etc/passwd", an
 * exact-match failure against the allowlist, not something a regex/suffix
 * check could be tricked by).
 */
export function isAllowedAttachmentType(fileName: string): boolean {
  return ALLOWED_ATTACHMENT_EXTENSIONS.includes(extensionOf(fileName));
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  mp4: "video/mp4",
  zip: "application/zip",
  txt: "text/plain",
  csv: "text/csv",
};

export function contentTypeForExtension(extension: string): string {
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/**
 * The object-store key an attachment is written to — deliberately NOT
 * derived from the user-supplied fileName beyond its (already
 * allowlist-validated) extension: a fresh random id makes storage keys
 * collision-free and immune to path traversal from the original name, which
 * is kept only as display metadata (Attachment.fileName) rather than part
 * of the storage path. Callers must pass a `fileType` that already passed
 * isAllowedAttachmentType — this function does not re-validate it.
 */
export function buildAttachmentStorageKey(tenantId: string, procedureId: string, fileType: string): string {
  return `${tenantId}/${procedureId}/${randomUUID()}.${fileType}`;
}
