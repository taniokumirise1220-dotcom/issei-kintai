import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "出勤簿アプリ | ISSEI",
  description: "出勤簿・給与明細管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
