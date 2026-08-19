import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// "Control Room" pairing (roadmap #7): Archivo for headings — a grotesk with
// enough presence to carry the brand, condensed/geometric character close to
// the Bahnschrift used in the concept pitch but a real cross-platform webfont
// (Bahnschrift is Windows-only; 200 employees are not all on Windows). Inter
// stays for body copy — it reads better at length than Archivo would. IBM
// Plex Mono is unchanged, still reserved for procedure codes and StatusStamp.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Archivo({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Procedure Hub",
  description: "Internal Procedure Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${inter.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
