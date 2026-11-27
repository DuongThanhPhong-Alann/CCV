"use client";

import { useEffect, useState } from "react";
import { isSoundMuted, playSound, preloadSounds, setSoundMuted } from "@/lib/sound-fx";

const INTERACTIVE_SELECTOR = [
  "button",
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  "a.topnav-tab",
  "a.create-diagram-button",
  "a.action-btn-link",
].join(", ");

export default function GlobalSoundEffects() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(isSoundMuted());
    preloadSounds();

    const handleMuteEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<{ muted?: boolean }>).detail;
      if (typeof detail?.muted === "boolean") {
        setMuted(detail.muted);
      } else {
        setMuted(isSoundMuted());
      }
    };

    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.button === 2) return;
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const control = target.closest(INTERACTIVE_SELECTOR);
      if (!control) return;
      if (control.hasAttribute("data-no-click-sound")) return;
      if (control instanceof HTMLButtonElement && control.disabled) return;
      if (control instanceof HTMLInputElement && control.disabled) return;
      if (control.getAttribute("aria-disabled") === "true") return;
      playSound("click");
    };

    window.addEventListener("ccv-sound-mute-change", handleMuteEvent);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      window.removeEventListener("ccv-sound-mute-change", handleMuteEvent);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setSoundMuted(next);
    setMuted(next);
    if (!next) {
      playSound("click");
    }
  };

  return (
    <button
      type="button"
      data-no-click-sound="true"
      className={`sound-toggle-fab ${muted ? "is-muted" : ""}`}
      onClick={toggleMute}
      title={muted ? "Bật hiệu ứng âm thanh" : "Tắt hiệu ứng âm thanh"}
      aria-label={muted ? "Bật hiệu ứng âm thanh" : "Tắt hiệu ứng âm thanh"}
    >
      <span>{muted ? "🔇" : "🔊"}</span>
      <span>{muted ? "Đã tắt tiếng" : "Âm thanh"}</span>
    </button>
  );
}
