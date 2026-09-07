import type { Metadata } from "next";
import { Outfit, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SnapImg — Resize & tối ưu nhiều ảnh",
  description: "Resize, nén, convert nhiều ảnh JPEG / PNG / WebP / AVIF. Tải ZIP.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${display.variable} ${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans text-[#10233a]">{children}</body>
    </html>
  );
}
