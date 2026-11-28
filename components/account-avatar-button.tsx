"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AVATAR_OPTIONS, findAvatarOption, resolveUserAvatar } from "@/lib/avatars";
import { readJsonResponse } from "@/lib/read-json-response";

const AVATAR_CHANGE_EVENT = "ccv-avatar-change";

export type UserAccountInfo = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
};

export default function AccountAvatarButton({
  account,
  onUpdated,
}: {
  account: UserAccountInfo | null;
  onUpdated?: (image: string) => void;
}) {
  const resolved = resolveUserAvatar({
    id: account?.id,
    email: account?.email,
    name: account?.name,
    image: account?.image,
  });

  const [currentSrc, setCurrentSrc] = useState(resolved);
  const [open, setOpen] = useState(false);
  const [selectedSrc, setSelectedSrc] = useState(resolved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setCurrentSrc(resolved);
    if (!open) setSelectedSrc(resolved);
  }, [resolved, open]);

  useEffect(() => {
    const handleSync = (ev: Event) => {
      const next = (ev as CustomEvent<{ image?: string }>).detail?.image;
      if (next) {
        setCurrentSrc(next);
        setSelectedSrc(next);
      }
    };
    window.addEventListener(AVATAR_CHANGE_EVENT, handleSync);
    return () => window.removeEventListener(AVATAR_CHANGE_EVENT, handleSync);
  }, []);

  const pickRandom = () => {
    const others = AVATAR_OPTIONS.filter((opt) => opt.src !== selectedSrc);
    const pool = others.length > 0 ? others : AVATAR_OPTIONS;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (chosen) setSelectedSrc(chosen.src);
  };

  const saveAvatar = async () => {
    if (!selectedSrc || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedSrc }),
      });
      const result = await readJsonResponse<{ error?: string; image?: string }>(response);
      if (!response.ok) throw new Error(result.error || "Không thể đổi ảnh đại diện.");
      const saved = result.image || selectedSrc;
      setCurrentSrc(saved);
      setOpen(false);
      onUpdated?.(saved);
      window.dispatchEvent(new CustomEvent(AVATAR_CHANGE_EVENT, { detail: { image: saved } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi ảnh đại diện.");
    } finally {
      setSaving(false);
    }
  };

  const activeOption = findAvatarOption(selectedSrc);

  return (
    <>
      <button
        type="button"
        className="user-avatar user-avatar-btn"
        title="Nhấn để đổi ảnh đại diện"
        aria-label="Đổi ảnh đại diện"
        onClick={() => {
          setSelectedSrc(currentSrc);
          setError("");
          setOpen(true);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentSrc}
          alt={account?.name || "Avatar"}
          className="avatar-img"
        />
        <span className="user-avatar-edit-dot" aria-hidden="true">✎</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="create-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setOpen(false);
          }}
        >
          <section
            className="create-dialog avatar-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-picker-title"
          >
            <button
              className="create-close"
              type="button"
              aria-label="Đóng"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              ×
            </button>

            <div className="avatar-picker-header">
              <div className="avatar-picker-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedSrc} alt={activeOption?.label || "Avatar"} />
              </div>
              <div className="avatar-picker-intro">
                <span className="dashboard-eyebrow">ẢNH ĐẠI DIỆN TÀI KHOẢN</span>
                <h2 id="avatar-picker-title">Chọn ảnh đại diện của bạn</h2>
                <p>
                  {account?.name || "Tài khoản"} · Đang chọn: <strong>{activeOption?.label || "Avatar"}</strong>
                </p>
              </div>
              <button
                type="button"
                className="code-secondary-button avatar-random-btn"
                disabled={saving}
                onClick={pickRandom}
              >
                🎲 Ngẫu nhiên
              </button>
            </div>

            <div className="avatar-options-grid" role="radiogroup" aria-label="Danh sách ảnh đại diện">
              {AVATAR_OPTIONS.map((option) => {
                const isSelected = selectedSrc === option.src;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`avatar-option-tile ${isSelected ? "is-selected" : ""}`}
                    disabled={saving}
                    onClick={() => setSelectedSrc(option.src)}
                  >
                    <span className="avatar-option-thumb">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={option.src} alt={option.label} loading="lazy" />
                      {isSelected && <span className="avatar-option-check">✓</span>}
                    </span>
                    <span className="avatar-option-label">{option.label}</span>
                  </button>
                );
              })}
            </div>

            {error && <div className="auth-error" role="alert">{error}</div>}

            <div className="create-dialog-actions">
              <button
                type="button"
                className="cancel-create"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="create-diagram-button"
                disabled={saving || selectedSrc === currentSrc}
                onClick={() => void saveAvatar()}
              >
                {saving ? "Đang lưu…" : "Lưu ảnh đại diện"}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
