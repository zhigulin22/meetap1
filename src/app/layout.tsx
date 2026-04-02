import type { Metadata } from "next";

import "../styles/theme.css";
import "./globals.css";
import { Providers } from "@/components/providers";

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
    <html lang="ru">
      <body className="bg-app text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
