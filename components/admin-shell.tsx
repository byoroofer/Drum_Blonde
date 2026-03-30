"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  { href: "/admin", label: "Dashboard" },
  { href: "/admin?tab=library", label: "Library" },
  { href: "/admin?tab=approvals", label: "Approvals" },
  { href: "/admin?tab=schedule", label: "Schedule" },
  { href: "/admin?tab=logs", label: "Logs" },
  { href: "/admin?tab=settings", label: "Settings" }
];

export function AdminShell({ user, children }: AdminShellProps) {
  const pathname = usePathname();

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
            <Link key={tab.href} href={tab.href} className={pathname === "/admin" && tab.href === "/admin" ? "rail-link rail-link--active" : "rail-link"}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="dashboard-main">{children}</div>
    </div>
  );
}

