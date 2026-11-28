"use client";

import AuthCheckLoader from "@/components/auth-check-loader";
import BoxesLoader from "@/components/boxes-loader";
import { hasRecentPostLoginTransition, readPostLoginDisplayName } from "@/lib/session-activity";

export default function Loading() {
  if (hasRecentPostLoginTransition()) {
    const name = readPostLoginDisplayName();
    return (
      <AuthCheckLoader
        displayName={name}
        message={
          name
            ? `Xin chào ${name}! Đang vào không gian làm việc…`
            : "Đăng nhập thành công! Đang vào không gian làm việc…"
        }
      />
    );
  }
  return (
    <div className="dashboard-loading">
      <BoxesLoader />
      <p>Đang tải trang…</p>
    </div>
  );
}
