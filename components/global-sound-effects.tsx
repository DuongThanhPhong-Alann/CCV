"use client";

import { useEffect } from "react";
import { playSound, preloadSounds, setSoundMuted, unlockAudio } from "@/lib/sound-fx";

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="tab"]',
  '[role="option"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  "summary",
].join(", ");

function isDisabledControl(control: Element): boolean {
  if (control.hasAttribute("data-no-click-sound")) return true;
  if (control.getAttribute("aria-disabled") === "true") return true;
  if (control instanceof HTMLButtonElement && control.disabled) return true;
  if (control instanceof HTMLInputElement && control.disabled) return true;
  return false;
}

export default function GlobalSoundEffects() {
  useEffect(() => {
    setSoundMuted(false);
    preloadSounds();

    const handlePointerDown = (ev: PointerEvent) => {
      if (ev.button === 2) return;
      unlockAudio();
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const control = target.closest(INTERACTIVE_SELECTOR);
      if (!control || isDisabledControl(control)) return;
      playSound("click");
    };

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      if (ev.repeat) return;
      const target = ev.target;
      if (!(target instanceof Element)) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (!(target instanceof HTMLInputElement) || !["button", "submit", "reset"].includes(target.type)) {
          return;
        }
      }
      const control = target.closest(INTERACTIVE_SELECTOR);
      if (!control || isDisabledControl(control)) return;
      unlockAudio();
      playSound("click");
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return null;
}
