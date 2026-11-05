"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarClock, ChartNoAxesCombined, ChevronDown, CircleHelp, LayoutDashboard, Menu, Search, Settings, TicketCheck, UsersRound, X } from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/customers", label: "Khách hàng", icon: UsersRound },
  { href: "/care", label: "Lịch chăm sóc", icon: CalendarClock, count: 12 },
  { href: "/tickets", label: "Phiếu yêu cầu", icon: TicketCheck, count: 3 },
  { href: "/reports", label: "Báo cáo", icon: ChartNoAxesCombined },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/login") return <>{children}</>;
  return <div className="app-frame">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark">N</div><div><strong>NICHIEI</strong><span>Customer Care</span></div><button className="icon-button mobile-only" onClick={() => setOpen(false)} aria-label="Đóng menu"><X size={20}/></button></div>
      <nav className="nav-list">
        <p className="nav-label">QUẢN LÝ</p>
        {nav.map(item => { const Icon=item.icon; const active=item.href === "/" ? pathname === "/" : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} className={active ? "nav-item active" : "nav-item"} onClick={() => setOpen(false)}><Icon size={19}/><span>{item.label}</span>{item.count && <b>{item.count}</b>}</Link>; })}
        <p className="nav-label nav-section">HỆ THỐNG</p>
        <Link href="/settings" className="nav-item"><Settings size={19}/><span>Cài đặt</span></Link>
        <a href="#help" className="nav-item"><CircleHelp size={19}/><span>Trợ giúp</span></a>
      </nav>
      <div className="sync-card"><span className="live-dot"/><strong>Haravan</strong><small>Chờ cấu hình kết nối</small></div>
      <div className="sidebar-user"><div className="avatar">VA</div><div><strong>Vân Anh</strong><span>Quản trị viên</span></div><ChevronDown size={17}/></div>
    </aside>
    {open && <button className="overlay" onClick={() => setOpen(false)} aria-label="Đóng menu"/>}
    <main className="main-area">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Mở menu"><Menu size={22}/></button><div className="global-search"><Search size={18}/><input aria-label="Tìm kiếm" placeholder="Tìm khách hàng, số điện thoại, mã đơn..."/><kbd>⌘ K</kbd></div><div className="top-actions"><button className="icon-button notification" aria-label="Thông báo"><Bell size={20}/><i/></button><form action="/api/auth/logout" method="post"><button className="user-chip" title="Bấm để đăng xuất"><div className="avatar small">VA</div><span>Vân Anh</span><ChevronDown size={16}/></button></form></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
