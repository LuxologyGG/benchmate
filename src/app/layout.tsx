import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BenchMate — Lab photos to verified reports",
  description:
    "Agentic pipeline that turns handwritten lab notebooks and instrument readouts into verified, formatted lab reports. Meta Global AI Developer Hackathon.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${mono.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col font-mono">{children}</body>
    </html>
  );
}
