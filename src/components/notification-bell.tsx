"use client";
import Link from "next/link";
import { Bell, CalendarClock, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
type Task = {
  id: string;
  customer: string;
  purpose: string;
  dueAt: string;
  status: string;
};
function dueText(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}
export function NotificationBell() {
  const [items, setItems] = useState<Task[]>([]),
    [open, setOpen] = useState(false),
    box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/care")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!active || !j?.data) return;
        const today = new Date().toISOString().slice(0, 10);
        setItems(
          j.data
            .filter(
              (x: Task) =>
                x.status !== "done" &&
                (x.status === "overdue" ||
                  x.dueAt.slice(0, 10) <= today ||
                  x.dueAt.startsWith("Hôm nay")),
            )
            .slice(0, 8),
        );
      });
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      active = false;
      document.removeEventListener("mousedown", close);
    };
  }, []);
  return (
    <div className="notification-wrap" ref={box}>
      <button
        className="icon-button notification"
        onClick={() => setOpen(!open)}
        aria-label="Mở thông báo"
      >
        <Bell size={20} />
        {items.length > 0 && (
          <b className="notification-count">{items.length}</b>
        )}
      </button>
      {open && (
        <div className="notification-menu">
          <header>
            <div>
              <b>Việc cần xử lý</b>
              <span>{items.length} thông báo đang chờ</span>
            </div>
            <Link href="/care">Xem tất cả</Link>
          </header>
          <div className="notification-list">
            {items.map((x) => (
              <Link key={x.id} href="/care" onClick={() => setOpen(false)}>
                <i className={x.status === "overdue" ? "late" : ""}>
                  <CalendarClock />
                </i>
                <span>
                  <b>{x.purpose}</b>
                  <small>
                    {x.customer} · {dueText(x.dueAt)}
                  </small>
                </span>
                <ChevronRight />
              </Link>
            ))}
            {!items.length && <p>Không có công việc cần xử lý.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
