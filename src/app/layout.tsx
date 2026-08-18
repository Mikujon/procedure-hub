import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// Notion-style: one clean sans for both UI and headings. The display variable
// now maps to Inter (tight, modern) instead of a serif — the serif read "old".
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Inter({ subsets: ["latin"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Procedure Hub",
  description: "Internal Procedure Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
