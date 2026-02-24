import type { Metadata } from "next";
import { Manrope, Rubik } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const rubik = Rubik({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
});

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
      <body className={`${rubik.variable} ${manrope.variable} font-sans`}>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{const t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
