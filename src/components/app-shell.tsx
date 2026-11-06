"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  TicketCheck,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notification-bell";
import type { SessionUser } from "@/lib/session";
import type { UserRole } from "@/lib/types";
const roleLabel = (role: UserRole) =>
  role === "admin"
    ? "Quáº£n trá»‹ viÃªn"
    : role === "sales"
      ? "NhÃ¢n viÃªn bÃ¡n hÃ ng"
      : "ChÄƒm sÃ³c khÃ¡ch hÃ ng";

const nav = [
  { href: "/", label: "Tá»•ng quan", icon: LayoutDashboard },
  { href: "/customers", label: "KhÃ¡ch hÃ ng", icon: UsersRound },
  { href: "/care", label: "Lá»‹ch chÄƒm sÃ³c", icon: CalendarClock },
  { href: "/tickets", label: "Phiáº¿u yÃªu cáº§u", icon: TicketCheck },
  { href: "/reports", label: "BÃ¡o cÃ¡o", icon: ChartNoAxesCombined },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: SessionUser | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/login") return <>{children}</>;
  return (
    <div className="app-frame">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <strong>NICHIEI</strong>
            <span>Customer Care</span>
          </div>
          <button
            className="icon-button mobile-only"
            onClick={() => setOpen(false)}
            aria-label="ÄÃ³ng menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list">
          <p className="nav-label">QUáº¢N LÃ</p>
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-item active" : "nav-item"}
                onClick={() => setOpen(false)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <p className="nav-label nav-section">Há»† THá»NG</p>
          {user?.role === "admin" && (
            <Link
              href="/accounts"
              className={
                pathname.startsWith("/accounts")
                  ? "nav-item active"
                  : "nav-item"
              }
            >
              <UserCog size={19} />
              <span>TÃ i khoáº£n</span>
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/settings" className="nav-item">
              <Settings size={19} />
              <span>CÃ i Ä‘áº·t</span>
            </Link>
          )}
          <Link href="/help" className="nav-item">
            <CircleHelp size={19} />
            <span>Trá»£ giÃºp</span>
          </Link>
        </nav>
        <div className="sync-card">
          <span className="live-dot" />
          <strong>Káº¿t ná»‘i bÃ¡n hÃ ng</strong>
          <small>Sáº½ bá»• sung sau báº£n dÃ¹ng thá»­</small>
        </div>
        <div className="sidebar-user">
          <div className="avatar">
            {user?.name
              .split(" ")
              .slice(-2)
              .map((x) => x[0])
              .join("") || "N"}
          </div>
          <div>
            <strong>{user?.name || "Nichiei"}</strong>
            <span>{user ? roleLabel(user.role) : ""}</span>
          </div>
          <ChevronDown size={17} />
        </div>
      </aside>
      {open && (
        <button
          className="overlay"
          onClick={() => setOpen(false)}
          aria-label="ÄÃ³ng menu"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setOpen(true)}
            aria-label="Má»Ÿ menu"
          >
            <Menu size={22} />
          </button>
          <form className="global-search" action="/customers" method="get">
            <Search size={18} />
            <input
              name="q"
              aria-label="TÃ¬m kiáº¿m"
              placeholder="TÃ¬m khÃ¡ch hÃ ng, sá»‘ Ä‘iá»‡n thoáº¡i, mÃ£ khÃ¡ch..."
            />
          </form>
          <div className="top-actions">
            <NotificationBell />
            <form action="/api/auth/logout" method="post">
              <button className="user-chip" title="ÄÄƒng xuáº¥t">
                <div className="avatar small">
                  {user?.name
                    .split(" ")
                    .slice(-2)
                    .map((x) => x[0])
                    .join("") || "N"}
                </div>
                <span>{user?.name || "Nichiei"}</span>
                <ChevronDown size={16} />
              </button>
            </form>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
