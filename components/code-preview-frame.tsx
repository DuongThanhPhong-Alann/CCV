"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { buildRunnerHtml } from "@/lib/code-grader";
import type { CodeAutoGradeResult, CodeBundle, CodeCriterion } from "@/lib/code-task-types";

export function analyzeCodeInSandbox(code: CodeBundle): Promise<{
  criteria: CodeCriterion[];
  consoleLogs: string[];
  errors: string[];
}> {
  return new Promise((resolve) => {
    const runId = `analyze_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "1024px";
    iframe.style.height = "720px";
    iframe.style.opacity = "0";
    iframe.style.zIndex = "-1";
    iframe.style.pointerEvents = "none";

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      iframe.remove();
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.source !== "ccv-code-runner" || data.runId !== runId) return;
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        criteria: Array.isArray(data.extractedCriteria) ? (data.extractedCriteria as CodeCriterion[]) : [],
        consoleLogs: Array.isArray(data.consoleLogs) ? (data.consoleLogs as string[]) : [],
        errors: Array.isArray(data.errors) ? (data.errors as string[]) : [],
      });
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ criteria: [], consoleLogs: [], errors: ["Quá thời gian phân tích code đáp án."] });
    }, 3500);

    window.addEventListener("message", onMessage);
    iframe.srcdoc = buildRunnerHtml({
      code,
      criteria: [],
      runId,
      mode: "analyze",
    });
    document.body.appendChild(iframe);
  });
}

export function evaluateCodeInSandbox(
  code: CodeBundle,
  criteria: CodeCriterion[],
  passThreshold = 100,
): Promise<CodeAutoGradeResult> {
  return new Promise((resolve) => {
    const runId = `grade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "1024px";
    iframe.style.height = "720px";
    iframe.style.opacity = "0";
    iframe.style.zIndex = "-1";
    iframe.style.pointerEvents = "none";

    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
      iframe.remove();
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.source !== "ccv-code-runner" || data.runId !== runId) return;
      if (settled) return;
      settled = true;
      cleanup();
      if (data.mode === "grade" && data.result) {
        resolve(data.result as CodeAutoGradeResult);
      } else {
        resolve({
          percentage: 0,
          earnedPoints: 0,
          totalPoints: criteria.reduce((s, c) => s + (c.weight || 1), 0),
          passed: false,
          passedCount: 0,
          totalCount: criteria.length,
          passThreshold,
          results: [],
          consoleLogs: [],
          errors: ["Không nhận được kết quả chấm bài."],
          evaluatedAt: new Date().toISOString(),
        });
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        percentage: 0,
        earnedPoints: 0,
        totalPoints: criteria.reduce((s, c) => s + (c.weight || 1), 0),
        passed: false,
        passedCount: 0,
        totalCount: criteria.length,
        passThreshold,
        results: [],
        consoleLogs: [],
        errors: ["Quá thời gian thực thi mã nguồn (kiểm tra vòng lặp vô hạn)."],
        evaluatedAt: new Date().toISOString(),
      });
    }, 4000);

    window.addEventListener("message", onMessage);
    iframe.srcdoc = buildRunnerHtml({
      code,
      criteria,
      runId,
      mode: "grade",
      passThreshold,
    });
    document.body.appendChild(iframe);
  });
}

type CodePreviewFrameProps = {
  code: CodeBundle;
  criteria?: CodeCriterion[];
  passThreshold?: number;
  runSignal: number;
  title?: string;
  height?: number;
  onPreviewLogs?: (payload: { consoleLogs: string[]; errors: string[] }) => void;
};

export default function CodePreviewFrame({
  code,
  criteria = [],
  passThreshold = 100,
  runSignal,
  title = "Kết quả trang web",
  height = 400,
  onPreviewLogs,
}: CodePreviewFrameProps) {
  const instanceId = useId();
  const callbackRef = useRef(onPreviewLogs);
  callbackRef.current = onPreviewLogs;

  const runId = `${instanceId}_${runSignal}`;

  const srcDoc = useMemo(() => {
    return buildRunnerHtml({
      code,
      criteria,
      runId,
      mode: "preview",
      passThreshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSignal, runId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.source !== "ccv-code-runner" || data.runId !== runId) return;
      if (data.mode === "preview" && callbackRef.current) {
        callbackRef.current({
          consoleLogs: Array.isArray(data.consoleLogs) ? (data.consoleLogs as string[]) : [],
          errors: Array.isArray(data.errors) ? (data.errors as string[]) : [],
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [runId]);

  return (
    <iframe
      key={runId}
      className="code-preview-iframe"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      title={title}
      style={{ height }}
    />
  );
}
