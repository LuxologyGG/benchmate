import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BenchMate Course Lab: catch the 10× mistake before it ruins the run",
  description:
    "A student lab partner: compares your lab manual to your notebook, catches 10× pipetting errors with deterministic tools, and writes a tool-cited record.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mono.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col font-mono">{children}</body>
    </html>
  );
}
