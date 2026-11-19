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
import { NichieiBrand } from "@/components/nichiei-brand";
import { UserMenu } from "@/components/user-menu";
import { hasPermission, type SessionUser } from "@/lib/session";
import type { UserRole } from "@/lib/types";
const roleLabel = (role: UserRole) =>
  role === "super_admin"
    ? "Super admin"
    : role === "admin"
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
  commerceStatus,
}: {
  children: React.ReactNode;
  user: SessionUser | null;
  commerceStatus: { ready: boolean; lastSyncAt: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  if (["/login", "/reset-password", "/change-password"].includes(pathname)) return <>{children}</>;
  const pageLabel = [...nav, { href: "/accounts", label: "Tài khoản" }, { href: "/settings", label: "Cài đặt" }, { href: "/help", label: "Trợ giúp" }].find((item) => item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))?.label || "CRM";
  return (
    <div className={`app-frame ${collapsed ? "nav-collapsed" : ""}`}>
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <NichieiBrand compact />
          <button
            className="icon-button mobile-only"
            onClick={() => setOpen(false)}
            aria-label="Đóng menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list">
          <p className="nav-label">KHÔNG GIAN LÀM VIỆC</p>
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
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          <p className="nav-label nav-section">QUẢN TRỊ & HỖ TRỢ</p>
          {(user?.role === "super_admin" || (user?.role === "admin" && user.canManageUsers)) && (
            <Link
              href="/accounts"
              onClick={() => setOpen(false)}
              title="Tài khoản" aria-label="Tài khoản"
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
          {user?.role === "super_admin" && (
            <Link href="/settings" onClick={() => setOpen(false)} title="Cài đặt" aria-label="Cài đặt" className={`nav-item ${pathname.startsWith("/settings") ? "active" : ""}`}>
              <Settings size={19} />
              <span>Cài đặt</span>
            </Link>
          )}
          <Link href="/help" onClick={() => setOpen(false)} title="Trợ giúp" aria-label="Trợ giúp" className={`nav-item ${pathname.startsWith("/help") ? "active" : ""}`}>
            <CircleHelp size={19} />
            <span>Trợ giúp</span>
          </Link>
        </nav>
        <div className="sync-card">
          <span className="live-dot" />
          <strong>Kết nối bán hàng</strong>
          <small>
            {commerceStatus.lastSyncAt
              ? `Đồng bộ ${new Date(commerceStatus.lastSyncAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}`
              : commerceStatus.ready
                ? "Haravan đã kết nối"
                : "Chưa kết nối Haravan"}
          </small>
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
          <button className="icon-button collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"} aria-expanded={!collapsed}><Menu size={20} /></button>
          <button
            className="icon-button menu-button"
            onClick={() => setOpen(true)}
            aria-label="Mở menu"
          >
            <Menu size={22} />
          </button>
          <div className="workspace-crumb"><span>Nichiei CRM</span><i>/</i><strong>{pageLabel}</strong></div>
          <form className="global-search" action="/customers" method="get">
            <Search size={18} />
            <input
              name="q"
              aria-label="Tìm kiếm"
              placeholder="Tìm khách hàng, số điện thoại..."
            />
          </form>
          <div className="top-actions">
            <NotificationBell />
            <UserMenu name={user?.name || "Nichiei"} />
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
