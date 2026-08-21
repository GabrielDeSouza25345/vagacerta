import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VagaCerta — seu ambiente de candidaturas",
  description: "Organize seu perfil, currículo, conexões e candidaturas em um ambiente individual e seguro.",
  metadataBase: new URL("https://vagacerta.example"),
  openGraph: {
    title: "VagaCerta",
    description: "Seu ambiente de candidaturas",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "VagaCerta — Seu ambiente de candidaturas" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VagaCerta",
    description: "Seu ambiente de candidaturas",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
