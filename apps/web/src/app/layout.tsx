import type { Metadata, Viewport } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "./mobile.css";
import { Providers } from "@/components/providers";

const cipSans = Source_Sans_3({
  variable: "--font-cip-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CIP | Inteligência de Gestão Municipal",
  description:
    "Plataforma do Centro de Inteligência Pública (CIP) para organizar informações, acompanhar prioridades e apoiar decisões da gestão municipal.",
  applicationName: "CIP Plataforma",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CIP" },
  icons: { apple: "/brand/apple-touch-icon.png" },
  authors: [{ name: "Centro de Inteligência Pública (CIP)" }],
  creator: "Centro de Inteligência Pública (CIP)",
  publisher: "Centro de Inteligência Pública (CIP)",
  keywords: [
    "CIP",
    "Centro de Inteligência Pública",
    "gestão municipal",
    "inteligência pública",
  ],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#151722",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${cipSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
