import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Selects — Film, Finally Personal",
  description:
    "Selects learns your taste and finds your next film in under five minutes. No algorithm. No noise. Just yours.",
  keywords: [
    "film discovery",
    "movie recommendations",
    "cinematic taste",
    "film DNA",
    "Selects",
  ],
  openGraph: {
    title: "Selects — Film, Finally Personal",
    description:
      "The film you've been looking for. Selects learns your taste and finds your next film in under five minutes.",
    url: "https://selects.film",
    siteName: "Selects",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        {children}
        <div className="film-grain" aria-hidden="true" />
      </body>
    </html>
  );
}
