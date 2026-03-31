"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

interface AdminShellProps {
  user: {
    displayName: string;
    email: string;
    mode: string;
  };
  children: ReactNode;
}

const tabs = [
  { href: "/admin", label: "Dashboard", tab: "dashboard" },
  { href: "/admin?tab=library", label: "Library", tab: "library" },
  { href: "/admin?tab=approvals", label: "Approvals", tab: "approvals" },
  { href: "/admin?tab=schedule", label: "Schedule", tab: "schedule" },
  { href: "/admin?tab=logs", label: "Logs", tab: "logs" },
  { href: "/admin?tab=settings", label: "Settings", tab: "settings" }
];

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = pathname === "/admin" ? searchParams.get("tab") || "dashboard" : "";

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-rail">
        <div className="brand-stack">
          <span className="brand-mark">BD</span>
          <div>
            <strong>Brooke Distribution</strong>
            <p>{user.mode === "demo" ? "Demo mode" : user.email}</p>
          </div>
        </div>
        <nav className="rail-nav" aria-label="Admin navigation">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className={pathname === "/admin" && currentTab === tab.tab ? "rail-link rail-link--active" : "rail-link"}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="dashboard-main">{children}</div>
    </div>
  );
}
