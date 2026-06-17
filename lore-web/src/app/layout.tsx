import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Lore Web",
  description: "Browser management dashboard for Lore servers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
