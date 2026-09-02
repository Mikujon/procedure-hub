import { getSharePointAccessToken, type SharePointCredentials } from "./sharepoint-auth";

/**
 * SharePoint integration — unlike Slack/Google Chat/Teams (chat
 * notifications) this isn't a webhook consumer: it's document
 * storage/collaboration, reached via Microsoft Graph's drive API. Only one
 * operation so far: push a file into a configured document library.
 * config = { azureTenantId, clientId, clientSecret, siteId, drivePath }
 *   - siteId: the Graph site id (`{hostname},{site-collection-id},{web-id}`,
 *     obtained via GET /sites/{hostname}:/{path} once during setup — not
 *     re-derived here).
 *   - drivePath: folder path inside the site's default document library,
 *     e.g. "Procedure Hub/Legal & Compliance" (created ahead of time in
 *     SharePoint; this call does not create folders).
 *
 * Simple PUT upload only (Graph's .../content endpoint) — good for up to
 * 4MB, which every procedure PDF/DOCX export in this app is expected to be
 * comfortably under. Above that Graph requires a chunked upload session
 * (createUploadSession + PUT byte ranges), not implemented: no procedure
 * export in this codebase has ever approached that size, and building
 * chunked-upload retry/resume logic for a case that's never occurred would
 * be guessing at a problem rather than solving one that's real.
 */

export interface SharePointUploadConfig extends SharePointCredentials {
  siteId: string;
  drivePath: string;
}

export interface SharePointUploadResult {
  webUrl: string;
  itemId: string;
}

function encodeDrivePathSegment(segment: string): string {
  // Each path segment individually, not the joined path — a literal `/`
  // typed into a segment (however unlikely) must stay a boundary, not get
  // encoded away and silently merged into the next segment or vice versa.
  return encodeURIComponent(segment);
}

function uploadUrl(config: SharePointUploadConfig, fileName: string): string {
  const folderSegments = config.drivePath.split("/").filter(Boolean).map(encodeDrivePathSegment);
  const path = [...folderSegments, encodeDrivePathSegment(fileName)].join("/");
  return `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(config.siteId)}/drive/root:/${path}:/content`;
}

export async function uploadFileToSharePoint(
  config: SharePointUploadConfig,
  fileName: string,
  contentType: string,
  buffer: Buffer
): Promise<SharePointUploadResult> {
  const accessToken = await getSharePointAccessToken(config);

  const res = await fetch(uploadUrl(config, fileName), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    // Node's Buffer is a Uint8Array at runtime (fetch accepts it fine) but
    // TS's lib.dom BodyInit type doesn't include Buffer specifically.
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`SharePoint upload failed with status ${res.status}${detail ? `: ${detail}` : ""}`);
  }

  const item = await res.json();
  if (!item.webUrl || !item.id) {
    throw new Error("SharePoint upload response missing webUrl/id — unexpected Graph API response shape");
  }
  return { webUrl: item.webUrl as string, itemId: item.id as string };
}
