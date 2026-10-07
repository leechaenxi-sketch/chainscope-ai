import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({ src: "../public/fonts/manrope.woff2", variable: "--font-manrope", display: "swap", weight: "200 800" });
const notoSans = localFont({ src: "../public/fonts/noto-sans-sc.woff2", variable: "--font-noto", display: "swap", weight: "100 900", preload: false });

export const metadata: Metadata = {
  title: "ChainScope AI",
  description: "AI-powered Ethereum anomaly investigation agent",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`${manrope.variable} ${notoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
