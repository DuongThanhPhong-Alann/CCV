"use client";

import { useEffect, useState } from "react";

/** Converts an ISO date string into `YYYY-MM-DDTHH:mm` in local browser time for datetime-local inputs. */
export function isoToLocalDateTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Converts a `YYYY-MM-DDTHH:mm` input string to ISO UTC string, or returns null when blank. */
export function localDateTimeInputToIso(localValue: string): string | null {
  const trimmed = localValue.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function endOfDayOffsetIso(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(23, 59, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T23:59`;
}

type DueDateAssignFieldProps = {
  value: string;
  onChange: (localDateTime: string) => void;
  disabled?: boolean;
  inputId?: string;
};

export function DueDateAssignField({
  value,
  onChange,
  disabled = false,
  inputId = "assign-due-at",
}: DueDateAssignFieldProps) {
  return (
    <div className="due-date-box">
      <div className="due-date-row">
        <label htmlFor={inputId}>⏰ Hạn cuối nộp bài (tùy chọn)</label>
        <div className="due-quick-presets">
          <button
            type="button"
            className="picker-chip-btn"
            disabled={disabled}
            onClick={() => onChange(endOfDayOffsetIso(1))}
          >
            23:59 ngày mai
          </button>
          <button
            type="button"
            className="picker-chip-btn"
            disabled={disabled}
            onClick={() => onChange(endOfDayOffsetIso(3))}
          >
            +3 ngày
          </button>
          {value && (
            <button
              type="button"
              className="picker-chip-btn is-clear"
              disabled={disabled}
              onClick={() => onChange("")}
            >
              Không giới hạn
            </button>
          )}
        </div>
      </div>
      <input
        id={inputId}
        type="datetime-local"
        className="due-datetime-input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <small className="due-hint-text">
        Nếu đặt hạn nộp (VD ngày 27/11), hệ thống tự động gửi 1 mail nhắc học viên vào <strong>21:30 tối hôm trước (26/11)</strong>.
      </small>
    </div>
  );
}

type DueDateEditorCardProps = {
  currentDueAt?: string | null;
  busy?: boolean;
  label?: string;
  onSave: (isoDueAt: string | null) => Promise<void>;
};

export function DueDateEditorCard({
  currentDueAt,
  busy = false,
  label = "Hạn nộp bài hiện tại",
  onSave,
}: DueDateEditorCardProps) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(() => isoToLocalDateTimeInput(currentDueAt));

  useEffect(() => {
    setDraftValue(isoToLocalDateTimeInput(currentDueAt));
  }, [currentDueAt]);

  const formattedCurrent = currentDueAt
    ? new Date(currentDueAt).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" })
    : "Chưa đặt hạn nộp";

  return (
    <div className="due-editor-bar">
      <div className="due-editor-summary">
        <span className="due-pill">
          ⏰ {label}: <strong>{formattedCurrent}</strong>
        </span>
        {!editing && (
          <button
            type="button"
            className="picker-chip-btn"
            disabled={busy}
            onClick={() => {
              setDraftValue(isoToLocalDateTimeInput(currentDueAt) || endOfDayOffsetIso(1));
              setEditing(true);
            }}
          >
            ✏️ Chỉnh thời gian giao
          </button>
        )}
      </div>

      {editing && (
        <div className="due-editor-controls">
          <input
            type="datetime-local"
            className="due-datetime-input"
            value={draftValue}
            disabled={busy}
            onChange={(e) => setDraftValue(e.target.value)}
          />
          <button
            type="button"
            className="create-diagram-button due-save-btn"
            disabled={busy}
            onClick={async () => {
              await onSave(localDateTimeInputToIso(draftValue));
              setEditing(false);
            }}
          >
            {busy ? "Đang lưu…" : "💾 Lưu hạn mới"}
          </button>
          <button
            type="button"
            className="picker-chip-btn is-clear"
            disabled={busy}
            onClick={async () => {
              await onSave(null);
              setEditing(false);
            }}
          >
            Xóa hạn
          </button>
          <button
            type="button"
            className="code-secondary-button"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            Hủy
          </button>
        </div>
      )}
    </div>
  );
}
