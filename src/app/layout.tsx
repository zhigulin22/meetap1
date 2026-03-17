import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "../styles/theme.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Meetap MVP",
  description: "Meetap social app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={manrope.variable}>
      <body className="bg-app text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
