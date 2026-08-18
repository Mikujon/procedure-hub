import jwt from "jsonwebtoken";

/**
 * Google service-account OAuth2 JWT-bearer flow (RFC 7523) — standard,
 * stable, and verifiable without live Workspace credentials: sign a claim
 * set with the service account's private key, exchange it at Google's
 * token endpoint for a bearer access token. Used by gchat.ts's bot-mode
 * send (GOOGLE_SERVICE_ACCOUNT_JSON).
 *
 * What this file does NOT cover, deliberately: the actual Chat API call to
 * find-or-create a DM space for a given GoogleChatUserIdentity and post a
 * message into it. That endpoint's exact behavior (space creation, domain-
 * wide delegation requirements for `chat.bot` vs `chat.app.spaces`, etc.)
 * needs verifying against a real Workspace + Google's current Chat API docs
 * before it's wired in — guessing at that contract without being able to
 * test it would produce code that looks complete but silently fails in
 * production, worse than leaving it explicit. See the TODO in gchat.ts.
 */

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function getGoogleAccessToken(serviceAccountJson: string, scopes: string[]): Promise<string> {
  let creds: ServiceAccountCredentials;
  try {
    creds = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error("Service account JSON missing client_email or private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: creds.client_email,
      scope: scopes.join(" "),
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    creds.private_key,
    { algorithm: "RS256" }
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google token exchange failed: ${data.error ?? "unknown error"}`);
  return data.access_token as string;
}
