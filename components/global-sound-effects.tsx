"use client";

import { useEffect } from "react";
import { playSound, preloadSounds, setSoundMuted } from "@/lib/sound-fx";

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
  useEffect(() => {
    setSoundMuted(false);
    preloadSounds();

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

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, []);

  return null;
}
