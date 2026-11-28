"use client";

import Link from "next/link";

export type TopNavKey = "diagrams" | "tasks" | "code-tasks" | "closure" | "activity";

type NavItem = {
  key: TopNavKey;
  href: string;
  label: string;
  tone: "blue" | "teal" | "gold" | "orange" | "burgundy";
};

const ALL_NAV_ITEMS: NavItem[] = [
  { key: "diagrams", href: "/", label: "📁 Sơ đồ của tôi", tone: "blue" },
  { key: "tasks", href: "/tasks", label: "📝 Bài tập", tone: "teal" },
  { key: "code-tasks", href: "/code-tasks", label: "💻 Code bài tập", tone: "gold" },
  { key: "closure", href: "/closure", label: "🔑 Tìm siêu khóa", tone: "orange" },
  { key: "activity", href: "/activity", label: "📊 Hoạt động", tone: "burgundy" },
];

export default function TopNavGlass({
  active,
  showActivity = false,
  breadcrumb,
}: {
  active: TopNavKey;
  showActivity?: boolean;
  breadcrumb?: string;
}) {
  const items = showActivity
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((item) => item.key !== "activity");

  return (
    <div className="topnav-glass-wrap">
      <nav className="topnav-entry-group" aria-label="Điều hướng chính">
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`topnav-entry-btn tone-${item.tone} ${isActive ? "active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {breadcrumb && <span className="topnav-breadcrumb">› {breadcrumb}</span>}
    </div>
  );
}
