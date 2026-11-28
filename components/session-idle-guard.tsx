"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  ACTIVITY_STORAGE_KEY,
  LOGOUT_BROADCAST_KEY,
  SESSION_IDLE_TIMEOUT_MS,
  broadcastIdleLogout,
  clearSessionActivity,
  markSessionActive,
  readLastActivityAt,
} from "@/lib/session-activity";

const ACTIVITY_THROTTLE_MS = 10_000;
const CHECK_INTERVAL_MS = 15_000;
const KEEPALIVE_INTERVAL_MS = 4 * 60 * 1000;
const KEEPALIVE_ACTIVE_WINDOW_MS = 5 * 60 * 1000;

export default function SessionIdleGuard() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const loggingOutRef = useRef(false);
  const lastWriteRef = useRef(0);
  const lastKeepAliveRef = useRef(0);

  useEffect(() => {
    if (isAuthPage) {
      loggingOutRef.current = false;
      lastKeepAliveRef.current = 0;
      return;
    }

    const triggerIdleLogout = async (broadcast = true) => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      clearSessionActivity();
      if (broadcast) {
        broadcastIdleLogout();
        try {
          await fetch("/api/activity/heartbeat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "logout",
              kind: "logout",
              path: pathname || "/",
              reason: "timeout",
            }),
            keepalive: true,
          });
        } catch {
          // ignore network errors during idle sign-out
        }
      }
      try {
        await signOut({ callbackUrl: "/login?reason=timeout" });
      } catch {
        window.location.replace("/login?reason=timeout");
      }
    };

    const refreshServerSession = async () => {
      if (loggingOutRef.current) return;
      lastKeepAliveRef.current = Date.now();
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { user?: { id?: string; email?: string } } | null;
        if (!data?.user?.id && !data?.user?.email) {
          await triggerIdleLogout(true);
        }
      } catch {
        // ignore transient network errors
      }
    };

    const checkIdleAndRefresh = () => {
      if (loggingOutRef.current) return;
      const now = Date.now();
      const last = readLastActivityAt();
      if (last !== null && now - last >= SESSION_IDLE_TIMEOUT_MS) {
        void triggerIdleLogout(true);
        return;
      }
      if (
        last !== null &&
        now - last < KEEPALIVE_ACTIVE_WINDOW_MS &&
        now - lastKeepAliveRef.current >= KEEPALIVE_INTERVAL_MS
      ) {
        void refreshServerSession();
      }
    };

    // Initial check on mount / route navigation
    const now = Date.now();
    const initialLast = readLastActivityAt();
    if (initialLast !== null && now - initialLast >= SESSION_IDLE_TIMEOUT_MS) {
      void triggerIdleLogout(true);
      return;
    }
    markSessionActive(now);
    lastWriteRef.current = now;
    if (lastKeepAliveRef.current === 0) {
      lastKeepAliveRef.current = now;
    } else if (now - lastKeepAliveRef.current >= KEEPALIVE_INTERVAL_MS) {
      void refreshServerSession();
    }

    const handleUserActivity = () => {
      if (loggingOutRef.current) return;
      const currentNow = Date.now();
      const last = readLastActivityAt();
      if (last !== null && currentNow - last >= SESSION_IDLE_TIMEOUT_MS) {
        void triggerIdleLogout(true);
        return;
      }
      if (currentNow - lastWriteRef.current >= ACTIVITY_THROTTLE_MS) {
        lastWriteRef.current = currentNow;
        markSessionActive(currentNow);
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "hidden") return;
      const currentNow = Date.now();
      const last = readLastActivityAt();
      if (last !== null && currentNow - last >= SESSION_IDLE_TIMEOUT_MS) {
        void triggerIdleLogout(true);
        return;
      }
      if (currentNow - lastKeepAliveRef.current >= KEEPALIVE_INTERVAL_MS) {
        void refreshServerSession();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_BROADCAST_KEY && event.newValue) {
        void triggerIdleLogout(false);
        return;
      }
      if (event.key === ACTIVITY_STORAGE_KEY && event.newValue) {
        const parsed = Number(event.newValue);
        if (Number.isFinite(parsed) && parsed > lastWriteRef.current) {
          lastWriteRef.current = parsed;
        }
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "wheel",
      "mousemove",
    ];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleUserActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("storage", handleStorage);

    const intervalId = window.setInterval(checkIdleAndRefresh, CHECK_INTERVAL_MS);

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleUserActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(intervalId);
    };
  }, [isAuthPage, pathname]);

  return null;
}
