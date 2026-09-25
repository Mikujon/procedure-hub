import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    // We don't use a real /login route (single-page constraint); the client
    // AppShell renders its own login screen when unauthenticated. This keeps
    // NextAuth's default pages from interfering.
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Ensure the demo tenants + users exist on a fresh database so the
        // very first login works without a manual seed step.
        try {
          await ensureSeed();
        } catch (e) {
          console.error("[auth] seed failed:", e);
        }

        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";
        if (!email || !password) return null;

        const user = await db.user.findUnique({
          where: { email },
          include: { tenant: true },
        });
        if (!user || !user.tenant) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          tenantId: user.tenantId,
          name: user.name,
          email: user.email,
          role: user.role,
          avatarColor: user.avatarColor,
          title: user.title ?? "",
          departmentId: user.departmentId ?? "",
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.id = u.id;
        token.tenantId = u.tenantId;
        token.role = u.role;
        token.avatarColor = u.avatarColor;
        token.title = u.title;
        token.departmentId = u.departmentId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const u = session.user as any;
        u.id = token.id;
        u.tenantId = token.tenantId;
        u.role = token.role;
        u.avatarColor = token.avatarColor;
        u.title = token.title;
        u.departmentId = token.departmentId;
      }
      return session;
    },
  },
};

export type AppSession = {
  user: {
    id: string;
    tenantId: string;
    name: string;
    email: string;
    role: string;
    avatarColor: string;
    title: string;
    departmentId: string | null;
  };
};
