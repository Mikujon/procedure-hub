import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AzureADProvider from "next-auth/providers/azure-ad";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Auth strategy:
 *  - CredentialsProvider: email + password, scoped to a tenant (resolved via
 *    the x-tenant-slug header at sign-in time). Used until SSO is configured.
 *  - AzureADProvider: wired but inactive unless env vars are set — this is
 *    the "future integration with Microsoft Entra ID" requirement. Once a
 *    tenant enables it (Integration row, type=ENTRA_ID), users signing in
 *    via Microsoft are matched/created by email and tenantId.
 *
 * Session strategy is JWT (no server-side session store needed at 200-user
 * scale); the JWT carries tenantId, userId, globalRole for fast checks.
 */

/**
 * NextAuth's authorize() receives a plain-object header bag (Record<string, any>),
 * not a Headers instance — lib/rate-limit.ts's clientIp() expects a real Request,
 * so it doesn't fit here. Header names arrive lowercased.
 */
function firstForwardedIp(headers: Record<string, any> | undefined): string | null {
  const fwd = headers?.["x-forwarded-for"];
  if (!fwd || typeof fwd !== "string") return null;
  return fwd.split(",")[0]?.trim() || null;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        tenantSlug: { label: "Tenant", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password || !credentials.tenantSlug) {
          return null;
        }

        // Brute-force defense: per-account limit (blocks repeated guesses against
        // one mailbox regardless of source IP) plus a looser per-IP limit (blocks
        // a credential-stuffing spray across many accounts from one source).
        // Fail-open on Redis unavailability — same policy as the rest of the app,
        // an outage here must not become a login outage.
        const ip = firstForwardedIp(req?.headers) ?? "unknown";
        const accountLimit = await checkRateLimit(
          `login:${credentials.tenantSlug}:${credentials.email.toLowerCase()}`,
          5,
          300
        );
        const ipLimit = await checkRateLimit(`login-ip:${ip}`, 20, 300);
        if (!accountLimit.allowed || !ipLimit.allowed) return null;

        const tenant = await prisma.tenant.findUnique({
          where: { slug: credentials.tenantSlug },
        });
        if (!tenant) return null;

        const user = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId: tenant.id, email: credentials.email } },
        });
        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl ?? undefined,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          globalRole: user.globalRole,
        } as any;
      },
    }),
    // Inactive until AZURE_AD_CLIENT_ID / SECRET / TENANT_ID are set in env.
    // Enables "Sign in with Microsoft" once a tenant turns on Entra ID SSO.
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "",
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = (user as any).id;
        token.tenantId = (user as any).tenantId;
        token.tenantSlug = (user as any).tenantSlug;
        token.globalRole = (user as any).globalRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).tenantSlug = token.tenantSlug;
        (session.user as any).globalRole = token.globalRole;
      }
      return session;
    },
  },
};
