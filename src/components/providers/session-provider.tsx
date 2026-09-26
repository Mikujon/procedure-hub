"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import * as React from "react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider
      // Force the session to be re-fetched on mount and when the window
      // regains focus — fixes a login-loop where useSession() returned a stale
      // "unauthenticated" state right after NextAuth set the cookie.
      refetchOnMount
      refetchOnWindowFocus
      refetchInterval={0}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
