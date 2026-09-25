import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProvider } from "@/components/providers/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Procedure Hub — Operational Procedure Workspace",
  description:
    "The operational registry for your organization's procedures, policies, and work instructions — with approval workflows, audit trail, and read & acknowledge.",
  keywords: [
    "procedure management",
    "compliance",
    "SOP",
    "policy",
    "work instruction",
    "audit trail",
    "ISO",
    "GDPR",
  ],
  authors: [{ name: "Procedure Hub" }],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Procedure Hub",
    description: "Operational procedure workspace with approval workflows and audit trail.",
    siteName: "Procedure Hub",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased bg-background text-foreground`}
      >
        <SessionProvider>
          <ThemeProvider>
            <QueryProvider>
              {children}
              <Toaster />
              <SonnerToaster richColors closeButton position="bottom-right" />
            </QueryProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
