import { NextRequest, NextResponse } from "next/server";

/**
 * Multi-tenant resolution strategy: subdomain-based.
 *   acme.procedurehub.com      -> tenant slug "acme"
 *   app.procedurehub.com       -> marketing/tenant-picker (no tenant)
 *   localhost:3000?tenant=acme -> dev override via query param
 *
 * The resolved tenant slug is forwarded as a request header so that every
 * server component / route handler can read it without re-parsing the host.
 * Actual tenant -> data scoping still happens in lib/tenant.ts against the DB;
 * this middleware only extracts the *candidate* slug.
 */

const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0];

  let tenantSlug: string | null = null;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    tenantSlug = url.searchParams.get("tenant");
  } else {
    const parts = hostname.split(".");
    // e.g. ["acme", "procedurehub", "com"] -> "acme"
    if (parts.length >= 3 && !RESERVED_SUBDOMAINS.has(parts[0])) {
      tenantSlug = parts[0];
    }
  }

  const requestHeaders = new Headers(req.headers);
  // Always strip first: a client that reaches this middleware on a hostname
  // we don't resolve a slug from (raw IP, preview URL, unexpected Host header)
  // must never have its own x-tenant-slug survive through to lib/tenant.ts.
  requestHeaders.delete("x-tenant-slug");
  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
