import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Research Agent",
  description: "Crypto and memecoin research + paper-trade journal",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
