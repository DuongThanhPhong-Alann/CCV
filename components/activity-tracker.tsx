"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ActivityKind } from "@/lib/activity-types";
import { SESSION_IDLE_TIMEOUT_MS, readLastActivityAt } from "@/lib/session-activity";

const HEARTBEAT_INTERVAL_MS = 10_000;
const INTERACTION_PING_THROTTLE_MS = 6_000;

function parseRouteActivity(pathname: string): {
  kind: ActivityKind;
  path: string;
  targetId: string | null;
} {
  const codeMatch = pathname.match(/^\/code-tasks\/([0-9a-f]{24})(?:\/|$)/i);
  if (codeMatch) return { kind: "code_task", path: `/code-tasks/${codeMatch[1]}`, targetId: codeMatch[1] };

  const taskMatch = pathname.match(/^\/tasks\/([0-9a-f]{24})(?:\/|$)/i);
  if (taskMatch) return { kind: "erd_task", path: `/tasks/${taskMatch[1]}`, targetId: taskMatch[1] };

  const diagramMatch = pathname.match(/^\/diagrams\/([0-9a-f]{24})(?:\/|$)/i);
  if (diagramMatch) return { kind: "diagram", path: `/diagrams/${diagramMatch[1]}`, targetId: diagramMatch[1] };

  if (pathname.startsWith("/closure")) return { kind: "closure", path: "/closure", targetId: null };
  if (pathname.startsWith("/code-tasks")) return { kind: "browse", path: "/code-tasks", targetId: null };
  if (pathname.startsWith("/tasks")) return { kind: "browse", path: "/tasks", targetId: null };
  if (pathname.startsWith("/activity")) return { kind: "browse", path: "/activity", targetId: null };
  return { kind: "browse", path: "/", targetId: null };
}

function sendBeaconOrKeepalive(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/activity/heartbeat", blob)) return;
    }
    void fetch("/api/activity/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore errors
  }
}

export default function ActivityTracker() {
  const pathname = usePathname();
  const isAuthPage = !pathname || pathname === "/login" || pathname === "/register";
  const latestRouteRef = useRef<{ kind: ActivityKind; path: string; targetId: string | null } | null>(null);

  useEffect(() => {
    if (isAuthPage || !pathname) {
      latestRouteRef.current = null;
      return;
    }

    const route = parseRouteActivity(pathname);
    latestRouteRef.current = route;
    let stopped = false;
    let lastPingAt = 0;

    const isSessionStillActive = () => {
      const lastAct = readLastActivityAt();
      return lastAct === null || Date.now() - lastAct < SESSION_IDLE_TIMEOUT_MS;
    };

    const postActivity = (event: "enter" | "heartbeat") => {
      if (stopped || !isSessionStillActive()) return;
      lastPingAt = Date.now();
      void fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, ...route }),
        cache: "no-store",
      }).catch(() => {});
    };

    postActivity("enter");

    // Continuous 10s heartbeat keeps admin monitor updated in real time (even in background tabs)
    const intervalId = window.setInterval(() => {
      if (!isSessionStillActive()) return;
      postActivity("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    const handleInteraction = () => {
      if (stopped || Date.now() - lastPingAt < INTERACTION_PING_THROTTLE_MS) return;
      postActivity("heartbeat");
    };

    const handleVisibilityChange = () => {
      if (!isSessionStillActive()) return;
      if (document.visibilityState === "hidden") {
        sendBeaconOrKeepalive({ event: "heartbeat", ...route });
      } else {
        postActivity("heartbeat");
      }
    };

    const handleFocus = () => {
      if (!isSessionStillActive()) return;
      postActivity("heartbeat");
    };

    const handlePageHide = () => {
      const current = latestRouteRef.current ?? route;
      sendBeaconOrKeepalive({ event: "leave", ...current });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pointerdown", handleInteraction, { passive: true });
    window.addEventListener("keydown", handleInteraction, { passive: true });

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pointerdown", handleInteraction);
      window.removeEventListener("keydown", handleInteraction);
    };
  }, [isAuthPage, pathname]);

  return null;
}
