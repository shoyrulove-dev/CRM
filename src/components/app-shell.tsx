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
import { hasPermission, type SessionUser } from "@/lib/session";
import type { UserRole } from "@/lib/types";
const roleLabel = (role: UserRole) =>
  role === "admin"
    ? "Quản trị viên"
    : role === "sales"
      ? "Nhân viên bán hàng"
      : "Chăm sóc khách hàng";

const nav = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/customers", label: "Khách hàng", icon: UsersRound },
  { href: "/care", label: "Lịch chăm sóc", icon: CalendarClock },
  { href: "/tickets", label: "Phiếu yêu cầu", icon: TicketCheck },
  { href: "/reports", label: "Báo cáo", icon: ChartNoAxesCombined },
];
const navPermission = {
  "/customers": "customers",
  "/care": "care",
  "/tickets": "tickets",
  "/reports": "reports",
} as const;

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
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list">
          <p className="nav-label">QUẢN LÝ</p>
          {nav
            .filter((item) => {
              const permission =
                navPermission[item.href as keyof typeof navPermission];
              return !permission || hasPermission(user, permission);
            })
            .map((item) => {
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
          <p className="nav-label nav-section">HỆ THỐNG</p>
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
              <span>Tài khoản</span>
            </Link>
          )}
          {user?.role === "admin" && (
            <Link href="/settings" className="nav-item">
              <Settings size={19} />
              <span>Cài đặt</span>
            </Link>
          )}
          <Link href="/help" className="nav-item">
            <CircleHelp size={19} />
            <span>Trợ giúp</span>
          </Link>
        </nav>
        <div className="sync-card">
          <span className="live-dot" />
          <strong>Kết nối bán hàng</strong>
          <small>Sẽ bổ sung sau bản dùng thử</small>
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
          aria-label="Đóng menu"
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button menu-button"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={22} />
          </button>
          <form className="global-search" action="/customers" method="get">
            <Search size={18} />
            <input
              name="q"
              aria-label="Tìm kiếm"
              placeholder="Tìm khách hàng, số điện thoại, mã khách..."
            />
          </form>
          <div className="top-actions">
            <NotificationBell />
            <form action="/api/auth/logout" method="post">
              <button className="user-chip" title="Đăng xuất">
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
