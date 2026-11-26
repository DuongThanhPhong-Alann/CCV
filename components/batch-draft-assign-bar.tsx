"use client";

import { useState } from "react";
import { DueDateAssignField, localDateTimeInputToIso } from "@/components/due-date-control";
import MultiRecipientPicker, { type RecipientAccount } from "@/components/multi-recipient-picker";
import { readJsonResponse } from "@/lib/read-json-response";

type DraftSummary = {
  id: string;
  title: string;
};

type BatchDraftAssignBarProps = {
  drafts: DraftSummary[];
  selectedIds: string[];
  onChangeSelected: (ids: string[]) => void;
  endpoint: string;
  onAssigned: (message: string) => Promise<void>;
  onError: (message: string) => void;
};

export default function BatchDraftAssignBar({
  drafts,
  selectedIds,
  onChangeSelected,
  endpoint,
  onAssigned,
  onError,
}: BatchDraftAssignBarProps) {
  const [busy, setBusy] = useState(false);
  const [dueAtLocal, setDueAtLocal] = useState("");

  if (drafts.length === 0) return null;

  const selectedDrafts = drafts.filter((d) => selectedIds.includes(d.id));
  const allSelected = selectedIds.length === drafts.length && drafts.length > 0;

  const handleBatchAssign = async (recipients: RecipientAccount[]) => {
    if (selectedIds.length === 0 || recipients.length === 0) return;
    setBusy(true);
    onError("");
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskIds: selectedIds,
          assignedToIds: recipients.map((r) => r.id),
          dueAt: localDateTimeInputToIso(dueAtLocal),
        }),
      });
      const result = await readJsonResponse<{
        error?: string;
        assignedTasks?: number;
        recipientCount?: number;
        totalCreated?: number;
        emailSentCount?: number;
        mailConfigured?: boolean;
      }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể giao hàng loạt bài tập.");
      const names = recipients.map((r) => r.name).join(", ");
      const mailNote =
        result.mailConfigured === false
          ? " (Chưa cấu hình SMTP_USER/SMTP_PASS trong .env.local nên chưa gửi email)."
          : typeof result.emailSentCount === "number"
            ? ` Đã gửi email thông báo tới ${result.emailSentCount}/${result.recipientCount ?? recipients.length} người.`
            : "";
      onChangeSelected([]);
      await onAssigned(
        `Đã giao ${result.assignedTasks ?? selectedIds.length} đề bài cho ${result.recipientCount ?? recipients.length} người (${names}) — tổng ${result.totalCreated ?? selectedIds.length * recipients.length} lượt làm bài.${mailNote}`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Không thể giao hàng loạt bài tập.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="batch-assign-wrapper">
      <div className="batch-select-toolbar">
        <div className="batch-select-info">
          <button
            type="button"
            className="code-secondary-button batch-toggle-btn"
            disabled={busy}
            onClick={() => onChangeSelected(allSelected ? [] : drafts.map((d) => d.id))}
          >
            {allSelected ? "☐ Bỏ chọn tất cả" : `☑ Chọn tất cả đề (${drafts.length})`}
          </button>
          {selectedIds.length > 0 && (
            <>
              <span className="batch-count-badge">Đã chọn {selectedIds.length}/{drafts.length} đề</span>
              <button
                type="button"
                className="picker-chip-btn is-clear"
                disabled={busy}
                onClick={() => onChangeSelected([])}
              >
                Bỏ chọn
              </button>
            </>
          )}
        </div>
        <span className="batch-hint-text">Tick vào nhiều đề bên dưới để giao cùng lúc cho nhiều học viên</span>
      </div>

      {selectedIds.length > 0 && (
        <div className="task-action-panel task-assign-panel batch-assign-panel">
          <div className="task-assign-copy">
            <h2>Giao {selectedIds.length} đề đã chọn cùng lúc</h2>
            <p>Mỗi học viên được chọn sẽ nhận đủ cả {selectedIds.length} đề bài thành từng lượt làm riêng.</p>
            <div className="selected-recipients-chips" style={{ marginTop: 10 }}>
              {selectedDrafts.map((draft) => (
                <span className="selected-recipient-chip" key={draft.id}>
                  <span>{draft.title}</span>
                  <button
                    type="button"
                    aria-label={`Bỏ chọn ${draft.title}`}
                    disabled={busy}
                    onClick={() => onChangeSelected(selectedIds.filter((id) => id !== draft.id))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <DueDateAssignField
              value={dueAtLocal}
              onChange={setDueAtLocal}
              disabled={busy}
              inputId="batch-due-at"
            />
          </div>
          <MultiRecipientPicker
            busy={busy}
            onAssign={handleBatchAssign}
            inputId="batch-recipient-search"
            submitPrefix={`Giao ${selectedIds.length} đề`}
          />
        </div>
      )}
    </section>
  );
}
