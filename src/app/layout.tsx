import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";

import "../styles/theme.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

export const viewport: Viewport = {
  themeColor: "#07070e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Meetap",
  description: "Соцсеть для офлайн-знакомств",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Meetap",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={`dark ${manrope.variable}`} suppressHydrationWarning>
      <body className="bg-app text-foreground font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}