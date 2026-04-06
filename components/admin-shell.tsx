"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface AdminShellProps {
  children: ReactNode;
}

const navGroups = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/media", label: "Media Library" },
      { href: "/admin#homepage-features", label: "Homepage Features" },
      { href: "/admin/live", label: "Live Control" }
    ]
  },
  {
    title: "Library Control",
    items: [
      { href: "/admin#albums", label: "Albums" },
      { href: "/admin#filters", label: "Filters" },
      { href: "/admin#overrides", label: "Overrides" },
      { href: "/admin#visibility", label: "Visibility" }
    ]
  },
  {
    title: "System",
    items: [
      { href: "/admin#diagnostics", label: "Diagnostics" },
      { href: "/admin#settings", label: "Settings" }
    ]
  }
];

function isActive(pathname: string, href: string) {
  const [targetPath] = href.split("#");
  if (!targetPath) {
    return false;
  }

  if (targetPath === "/admin") {
    return pathname === "/admin";
  }

  return pathname === targetPath;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="admin-app-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__mark">DB</span>
          <div>
            <strong>Admin Control Panel</strong>
            <p>Drum Blonde media operations</p>
          </div>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {navGroups.map((group) => (
            <div key={group.title} className="admin-sidebar__group">
              <p className="admin-sidebar__group-label">{group.title}</p>
              <div className="admin-sidebar__links">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`admin-sidebar__link${isActive(pathname, item.href) ? " admin-sidebar__link--active" : ""}`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="admin-app-shell__content">{children}</div>
    </div>
  );
}
