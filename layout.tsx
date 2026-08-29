import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Sans for the system, serif for the law.
 *
 * The split is functional, not decorative: it tells the eye instantly
 * whether it is looking at the software or at legal content. Inter
 * carries every label, table and control; Source Serif carries draft
 * bodies, document text, quoted orders and AI legal prose; JetBrains
 * Mono carries case numbers and identifiers, which must align
 * vertically in a list to be scannable.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * `maximumScale: 1` and `userScalable: false` were removed here.
 *
 * They fail WCAG 1.4.4 (Resize Text) outright, and they are especially
 * wrong for this product: advocates read judgments and depositions on
 * phones, often in poor light, and pinch-zoom is how they cope. Text
 * must scale to 200% without loss of function.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#131211" },
  ],
};

export const metadata: Metadata = {
  title: "LegalDesk — AI Legal Case Management",
  description: "Intelligent legal case management platform powered by AI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // `dark` stays hard-coded until the theme preference lands in
      // settings. Dark is the intended default: legal work runs late.
      className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
      data-density="default"
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
