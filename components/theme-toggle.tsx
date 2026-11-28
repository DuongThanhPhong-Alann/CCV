"use client";

import { useEffect, useId, useState } from "react";
import { playSound } from "@/lib/sound-fx";

const THEME_STORAGE_KEY = "ccv_theme";
const THEME_EVENT = "ccv-theme-change";

export type AppTheme = "light" | "dark";

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "light";
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.dataset.theme = "dark";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

export default function ThemeToggle() {
  const inputId = useId();
  const [theme, setTheme] = useState<AppTheme>("light");

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);

    const handleThemeEvent = (ev: Event) => {
      const next = (ev as CustomEvent<{ theme?: AppTheme }>).detail?.theme;
      if (next === "dark" || next === "light") {
        setTheme(next);
        applyTheme(next);
      }
    };

    const handleStorage = (ev: StorageEvent) => {
      if (ev.key === THEME_STORAGE_KEY) {
        const next: AppTheme = ev.newValue === "dark" ? "dark" : "light";
        setTheme(next);
        applyTheme(next);
      }
    };

    window.addEventListener(THEME_EVENT, handleThemeEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(THEME_EVENT, handleThemeEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const isDark = theme === "dark";

  const onToggle = (checked: boolean) => {
    const next: AppTheme = checked ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: next } }));
    playSound("click");
  };

  return (
    <div
      className="theme-switch-container"
      title={isDark ? "Giao diện tối — nhấn để chuyển sáng" : "Giao diện sáng — nhấn để chuyển tối"}
    >
      <input
        type="checkbox"
        id={inputId}
        className="theme-switch-checkbox"
        checked={isDark}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      />
      <label htmlFor={inputId} className="theme-switch-label" />
    </div>
  );
}
