"use client";

import { useId } from "react";

export type PedestalTone = "green" | "gold" | "blue" | "red" | "slate";

const PALETTES: Record<
  PedestalTone,
  {
    rim: string;
    leftFace: string;
    rightFace: string;
    p1: string;
    p2: string;
  }
> = {
  green: {
    rim: "#10b981",
    leftFace: "#059669",
    rightFace: "#10b981",
    p1: "#a7f3d0",
    p2: "#34d399",
  },
  gold: {
    rim: "#d3a410",
    leftFace: "#b7870f",
    rightFace: "#d3a410",
    p1: "#ffe4a1",
    p2: "#ccb069",
  },
  blue: {
    rim: "#3b82f6",
    leftFace: "#1d4ed8",
    rightFace: "#3b82f6",
    p1: "#bfdbfe",
    p2: "#60a5fa",
  },
  red: {
    rim: "#ef4444",
    leftFace: "#b91c1c",
    rightFace: "#ef4444",
    p1: "#fecaca",
    p2: "#f87171",
  },
  slate: {
    rim: "#94a3b8",
    leftFace: "#475569",
    rightFace: "#64748b",
    p1: "#e2e8f0",
    p2: "#94a3b8",
  },
};

export default function TaskPedestalIcon({ tone }: { tone: PedestalTone }) {
  const uid = useId().replace(/:/g, "");
  const gBase = `${uid}-g1`;
  const gLeft = `${uid}-g2`;
  const gRight = `${uid}-g3`;
  const c = PALETTES[tone];

  return (
    <div className={`task-pedestal-wrap tone-${tone}`} aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="12 0 176 204" className="task-pedestal-svg">
        <defs>
          <linearGradient y2="100%" x2="10%" y1="0%" x1="0%" id={gBase}>
            <stop stopColor="#1e2026" stopOpacity={1} offset="20%" />
            <stop stopColor="#414750" stopOpacity={1} offset="60%" />
          </linearGradient>
          <linearGradient y2="100%" x2="0%" y1="-17%" x1="10%" id={gLeft}>
            <stop stopColor={c.rim} stopOpacity={0} offset="20%" />
            <stop stopColor={c.rim} stopOpacity={0.56} offset="100%" className="pedestal-stop" />
          </linearGradient>
          <linearGradient y2="100%" x2="10%" y1="0%" x1="0%" id={gRight}>
            <stop stopColor={c.rim} stopOpacity={0} offset="20%" />
            <stop stopColor={c.rim} stopOpacity={0.56} offset="100%" className="pedestal-stop" />
          </linearGradient>
        </defs>
        <g>
          <polygon
            transform="rotate(45 100 100)"
            strokeWidth="1.4"
            stroke={c.rim}
            fill="none"
            points="70,70 148,50 130,130 50,150"
            className="pedestal-bounce"
          />
          <polygon
            transform="rotate(45 100 100)"
            strokeWidth="1.4"
            stroke={c.rim}
            fill="none"
            points="70,70 148,50 130,130 50,150"
            className="pedestal-bounce2"
          />
          <polygon
            transform="rotate(45 100 100)"
            strokeWidth="2"
            fill="#414750"
            points="70,70 150,50 130,130 50,150"
          />
          <polygon
            strokeWidth="2"
            fill={`url(#${gBase})`}
            points="100,70 150,100 100,130 50,100"
          />
          <polygon
            transform="translate(20, 31)"
            strokeWidth="2"
            fill={c.leftFace}
            points="80,50 80,75 80,99 40,75"
          />
          <polygon
            transform="translate(20, 31)"
            strokeWidth="2"
            fill={`url(#${gLeft})`}
            points="40,-40 80,-40 80,99 40,75"
          />
          <polygon
            transform="rotate(180 100 100) translate(20, 20)"
            strokeWidth="2"
            fill={c.rightFace}
            points="80,50 80,75 80,99 40,75"
          />
          <polygon
            transform="rotate(0 100 100) translate(60, 20)"
            strokeWidth="2"
            fill={`url(#${gRight})`}
            points="40,-40 80,-40 80,85 40,110.2"
          />
          <polygon
            transform="rotate(45 100 100) translate(80, 95)"
            strokeWidth="2"
            fill={c.p1}
            points="5,0 5,5 0,5 0,0"
            className="pedestal-particle"
          />
          <polygon
            transform="rotate(45 100 100) translate(80, 55)"
            strokeWidth="2"
            fill={c.p2}
            points="6,0 6,6 0,6 0,0"
            className="pedestal-particle"
          />
          <polygon
            transform="rotate(45 100 100) translate(70, 80)"
            strokeWidth="2"
            fill="#ffffff"
            points="2,0 2,2 0,2 0,0"
            className="pedestal-particle"
          />
          <polygon
            strokeWidth="2"
            fill="#292d34"
            points="29.5,99.8 100,142 100,172 29.5,130"
          />
          <polygon
            transform="translate(50, 92)"
            strokeWidth="2"
            fill="#1f2127"
            points="50,50 120.5,8 120.5,35 50,80"
          />
        </g>
      </svg>
    </div>
  );
}
