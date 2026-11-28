"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { ActivityKind } from "@/lib/activity-types";
import { SESSION_IDLE_TIMEOUT_MS, readLastActivityAt } from "@/lib/session-activity";

const HEARTBEAT_INTERVAL_MS = 45_000;
const ACTIVE_INTERACTION_WINDOW_MS = 3 * 60 * 1000;

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

  useEffect(() => {
    if (isAuthPage || !pathname) return;

    const route = parseRouteActivity(pathname);
    let stopped = false;

    const postActivity = (event: "enter" | "heartbeat") => {
      if (stopped) return;
      const lastAct = readLastActivityAt();
      if (lastAct !== null && Date.now() - lastAct >= SESSION_IDLE_TIMEOUT_MS) return;
      void fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, ...route }),
        cache: "no-store",
      }).catch(() => {});
    };

    postActivity("enter");

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const lastAct = readLastActivityAt();
      if (lastAct !== null && Date.now() - lastAct > ACTIVE_INTERACTION_WINDOW_MS) return;
      postActivity("heartbeat");
    }, HEARTBEAT_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendBeaconOrKeepalive({ event: "leave", ...route });
      } else {
        postActivity("enter");
      }
    };

    const handlePageHide = () => {
      sendBeaconOrKeepalive({ event: "leave", ...route });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      stopped = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      sendBeaconOrKeepalive({ event: "leave", ...route });
    };
  }, [isAuthPage, pathname]);

  return null;
}
