import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERD Studio — Thiết kế cơ sở dữ liệu",
  description: "Không gian trực quan để thiết kế sơ đồ quan hệ cơ sở dữ liệu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
