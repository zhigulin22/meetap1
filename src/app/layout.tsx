import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Meetap MVP",
  description: "Соцсеть для офлайн-знакомств",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={spaceGrotesk.className}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{const t=localStorage.getItem(theme);if(t===dark){document.documentElement.classList.add(dark)}}catch(e){}",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
