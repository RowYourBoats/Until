import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Until App",
  description: "Minimalist event list",
  themeColor: "#293c64",
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
