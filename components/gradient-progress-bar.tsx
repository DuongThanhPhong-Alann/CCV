"use client";

import type { CSSProperties } from "react";

type GradientProgressBarProps = {
  percentage: number;
  size?: "sm" | "md";
  ariaLabel?: string;
};

export default function GradientProgressBar({
  percentage,
  size = "md",
  ariaLabel,
}: GradientProgressBarProps) {
  const safeValue = Number.isFinite(percentage)
    ? Math.max(0, Math.min(100, Math.round(percentage)))
    : 0;
  const label = `${safeValue}%`;

  return (
    <div
      className={`neo-progress-loader is-${size}`}
      style={{ "--progress-pct": `${safeValue}%` } as CSSProperties}
      role="progressbar"
      aria-valuenow={safeValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `Tiến độ ${label}`}
    >
      <div className="neo-progress-fill" data-percentage={label} aria-hidden="true" />
      <span className="neo-progress-label is-base" aria-hidden="true">
        {label}
      </span>
      <span className="neo-progress-label is-fill" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
