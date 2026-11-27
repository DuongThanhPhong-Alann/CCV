import type { Metadata } from "next";
import GlobalSoundEffects from "@/components/global-sound-effects";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERD Draw — Vẽ sơ đồ ERD và xuất mã tạo cơ sở dữ liệu",
  description: "Vẽ sơ đồ ERD trực quan, dễ bắt đầu. Tạo bảng, khai báo khóa và mối quan hệ, sau đó xuất câu lệnh khởi tạo cơ sở dữ liệu cho SQL, MongoDB hoặc Supabase.",
  openGraph: {
    title: "ERD Draw — Thiết kế ERD, xuất câu lệnh tạo CSDL",
    description: "Công cụ vẽ ERD trực quan cho người mới bắt đầu. Tạo bảng, thiết lập quan hệ và xuất mã khởi tạo cơ sở dữ liệu cho SQL, MongoDB hoặc Supabase.",
    siteName: "ERD Draw",
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ERD Draw — Thiết kế ERD, xuất câu lệnh tạo CSDL",
    description: "Vẽ bảng và mối quan hệ trực quan, sau đó xuất mã cho SQL, MongoDB hoặc Supabase.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        {children}
        <GlobalSoundEffects />
      </body>
    </html>
  );
}
