"use client";

import { useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

type MailActionsBarProps = {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

export default function MailActionsBar({ onSuccess, onError }: MailActionsBarProps) {
  const [busyAction, setBusyAction] = useState<"" | "warnings" | "summary">("");

  const trigger = async (action: "sendDeadlineWarnings" | "sendDailySummary") => {
    setBusyAction(action === "sendDeadlineWarnings" ? "warnings" : "summary");
    onError("");
    try {
      const response = await fetch("/api/mail-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await readJsonResponse<{
        error?: string;
        emailsSent?: number;
        studentsMatched?: number;
        tasksNotified?: number;
        mailConfigured?: boolean;
        dateLabel?: string;
      }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể chạy tác vụ gửi email.");
      if (result.mailConfigured === false) {
        onError("Chưa cấu hình SMTP_USER/SMTP_PASS trong .env.local nên chưa thể gửi mail thật.");
        return;
      }
      if (action === "sendDeadlineWarnings") {
        onSuccess(
          result.studentsMatched
            ? `Đã gửi ${result.emailsSent ?? 0} email nhắc hạn (gom ${result.tasksNotified ?? 0} bài sắp tới hạn cho ${result.studentsMatched} học viên).`
            : "Hiện không có bài tập nào có hạn nộp cần nhắc nhở.",
        );
      } else {
        onSuccess(
          result.emailsSent
            ? `Đã gửi báo cáo tổng hợp cuối ngày (${result.dateLabel ?? "hôm nay"}) tới email của bạn.`
            : "Chưa gửi được báo cáo tổng hợp (kiểm tra cấu hình SMTP hoặc email tài khoản).",
        );
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không thể gửi email.");
    } finally {
      setBusyAction("");
    }
  };

  return (
    <div className="mail-digest-bar">
      <div className="mail-digest-info">
        <strong>📬 Nhắc hạn &amp; Báo cáo tự động qua Email</strong>
        <small>Hệ thống tự nhắc học viên lúc <strong>21:30</strong> hôm trước hạn nộp và gửi báo cáo tổng hợp lúc <strong>22:00</strong> cuối ngày.</small>
      </div>
      <div className="mail-digest-actions">
        <button
          type="button"
          className="picker-chip-btn"
          disabled={Boolean(busyAction)}
          onClick={() => void trigger("sendDeadlineWarnings")}
        >
          {busyAction === "warnings" ? "Đang gửi…" : "⏰ Gửi nhắc hạn ngay"}
        </button>
        <button
          type="button"
          className="picker-chip-btn"
          disabled={Boolean(busyAction)}
          onClick={() => void trigger("sendDailySummary")}
        >
          {busyAction === "summary" ? "Đang gửi…" : "📊 Gửi tổng hợp hôm nay"}
        </button>
      </div>
    </div>
  );
}
