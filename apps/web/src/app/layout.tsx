import type { Metadata } from "next";
import { Outfit, Syne } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-outfit",
});

const syne = Syne({
  subsets: ["latin", "latin-ext"],
  variable: "--font-syne",
});

export const metadata: Metadata = {
  title: "Soneo",
  description: "Oda aç, nickini yaz, konuş.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr">
      <body className={`${outfit.variable} ${syne.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
