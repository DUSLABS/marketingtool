import type { Metadata } from "next";
import { DM_Serif_Display, Geist, Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Slide fonts: shared by the editor preview and the server renderer so line breaks match.
const slideSans = Inter({
  variable: "--font-slide-sans",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
});

const slideSerif = DM_Serif_Display({
  variable: "--font-slide-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: { default: "Slides Autopilot", template: "%s · Slides Autopilot" },
  description: "Automated TikTok slideshow campaigns.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} ${slideSans.variable} ${slideSerif.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
