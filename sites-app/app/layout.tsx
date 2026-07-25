import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClawMarket — Supermercado Bengala",
  description:
    "Gestão de produtos próximos ao vencimento e jornal de Ofertas Internas da Loja 3.",
  manifest: "/app/manifest.webmanifest",
  icons: {
    icon: "/app/favicon.svg",
    shortcut: "/app/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
