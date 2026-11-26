"use client";

import { useEffect, useState } from "react";
import { readJsonResponse } from "@/lib/read-json-response";

export type RecipientAccount = {
  id: string;
  name: string;
  email: string;
};

type MultiRecipientPickerProps = {
  busy: boolean;
  disabled?: boolean;
  alreadyAssignedEmails?: string[];
  onAssign: (recipients: RecipientAccount[]) => Promise<void>;
  inputId?: string;
  submitPrefix?: string;
};

export default function MultiRecipientPicker({
  busy,
  disabled = false,
  alreadyAssignedEmails = [],
  onAssign,
  inputId = "multi-recipient-search",
  submitPrefix = "Giao bài tập",
}: MultiRecipientPickerProps) {
  const [query, setQuery] = useState("");
  const [accounts, setAccounts] = useState<RecipientAccount[]>([]);
  const [selected, setSelected] = useState<RecipientAccount[]>([]);
  const [searching, setSearching] = useState(false);

  const assignedSet = new Set(alreadyAssignedEmails.map((email) => email.toLowerCase()));
  const selectedIds = new Set(selected.map((item) => item.id));

  useEffect(() => {
    const trimmed = query.trim();
    const controller = new AbortController();
    const delay = trimmed ? 200 : 0;

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const url = trimmed
          ? `/api/tasks/recipients?query=${encodeURIComponent(trimmed)}`
          : "/api/tasks/recipients?all=1";
        const response = await fetch(url, { cache: "no-store", signal: controller.signal });
        const result = await readJsonResponse<{ accounts?: RecipientAccount[] }>(response);
        if (response.ok) setAccounts(result.accounts ?? []);
      } catch {
        if (!controller.signal.aborted) setAccounts([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, delay);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const toggleRecipient = (account: RecipientAccount) => {
    setSelected((prev) =>
      prev.some((item) => item.id === account.id)
        ? prev.filter((item) => item.id !== account.id)
        : [...prev, account],
    );
  };

  const selectAllVisible = (onlyUnassigned = false) => {
    const candidates = onlyUnassigned
      ? accounts.filter((acc) => !assignedSet.has(acc.email.toLowerCase()))
      : accounts;
    setSelected((prev) => {
      const nextMap = new Map(prev.map((item) => [item.id, item]));
      for (const acc of candidates) nextMap.set(acc.id, acc);
      return Array.from(nextMap.values());
    });
  };

  const clearSelection = () => {
    setSelected([]);
  };

  const handleAssignClick = async () => {
    if (selected.length === 0 || busy || disabled) return;
    await onAssign(selected);
    setSelected([]);
    setQuery("");
  };

  const hasAlreadyAssigned = accounts.some((acc) => assignedSet.has(acc.email.toLowerCase()));

  return (
    <div className="recipient-picker multi-recipient-picker">
      <div className="multi-picker-header">
        <label htmlFor={inputId}>Chọn một hoặc nhiều tài khoản học viên</label>
        <div className="multi-picker-quick-actions">
          {accounts.length > 0 && (
            <button
              type="button"
              className="picker-chip-btn"
              disabled={busy}
              onClick={() => selectAllVisible(false)}
            >
              Chọn tất cả ({accounts.length})
            </button>
          )}
          {hasAlreadyAssigned && (
            <button
              type="button"
              className="picker-chip-btn"
              disabled={busy}
              onClick={() => selectAllVisible(true)}
            >
              Chỉ chọn người chưa giao
            </button>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              className="picker-chip-btn is-clear"
              disabled={busy}
              onClick={clearSelection}
            >
              Bỏ chọn ({selected.length})
            </button>
          )}
        </div>
      </div>

      <input
        id={inputId}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nhập tên hoặc email để lọc nhanh…"
      />

      <div className="multi-recipient-list" role="listbox" aria-multiselectable="true" aria-label="Danh sách tài khoản">
        {searching ? (
          <p className="multi-recipient-empty">Đang tải danh sách tài khoản…</p>
        ) : accounts.length ? (
          accounts.map((account) => {
            const isChecked = selectedIds.has(account.id);
            const isAlreadyAssigned = assignedSet.has(account.email.toLowerCase());
            return (
              <label
                key={account.id}
                className={`multi-recipient-option ${isChecked ? "is-checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={busy}
                  onChange={() => toggleRecipient(account)}
                />
                <span className="multi-recipient-info">
                  <strong>{account.name}</strong>
                  <small>{account.email}</small>
                </span>
                {isAlreadyAssigned && <span className="already-assigned-tag">Đã giao</span>}
              </label>
            );
          })
        ) : (
          <p className="multi-recipient-empty">Không tìm thấy tài khoản phù hợp.</p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="selected-recipients-chips" aria-label="Danh sách đã chọn">
          {selected.map((item) => (
            <span className="selected-recipient-chip" key={item.id}>
              <span>{item.name}</span>
              <button
                type="button"
                aria-label={`Bỏ chọn ${item.name}`}
                disabled={busy}
                onClick={() => toggleRecipient(item)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <button
        className="create-diagram-button"
        type="button"
        disabled={busy || disabled || selected.length === 0}
        onClick={() => void handleAssignClick()}
      >
        {busy
          ? "Đang giao bài…"
          : selected.length > 0
            ? `${submitPrefix} cho ${selected.length} người`
            : "Chọn người để giao bài"}
      </button>
    </div>
  );
}
