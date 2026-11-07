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
  category: string;
  read: boolean;
};
const dueText = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
};
export function NotificationBell() {
  const [items, setItems] = useState<Task[]>([]),
    [unread, setUnread] = useState(0),
    [open, setOpen] = useState(false),
    box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/notifications")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (active && json?.data) {
          setItems(json.data);
          setUnread(json.unread);
        }
      });
    const close = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      active = false;
      document.removeEventListener("mousedown", close);
    };
  }, []);
  async function read(task: Task) {
    if (!task.read) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [task.id] }),
      });
      setItems((old) =>
        old.map((item) =>
          item.id === task.id ? { ...item, read: true } : item,
        ),
      );
      setUnread((value) => Math.max(0, value - 1));
    }
    setOpen(false);
  }
  return (
    <div className="notification-wrap" ref={box}>
      <button
        className="icon-button notification"
        onClick={() => setOpen(!open)}
        aria-label="Mở thông báo"
      >
        <Bell size={20} />
        {unread > 0 && (
          <b className="notification-count">{unread > 9 ? "9+" : unread}</b>
        )}
      </button>
      {open && (
        <div className="notification-menu">
          <header>
            <div>
              <b>Việc cần xử lý</b>
              <span>{unread} thông báo chưa xem</span>
            </div>
            <Link href="/care">Xem tất cả</Link>
          </header>
          <div className="notification-list">
            {items.map((item) => (
              <Link
                className={item.read ? "read" : ""}
                key={item.id}
                href={`/care?task=${encodeURIComponent(item.id)}`}
                onClick={() => read(item)}
              >
                <i className={item.category === "Quá hạn" ? "late" : ""}>
                  <CalendarClock />
                </i>
                <span>
                  <em>{item.category}</em>
                  <b>{item.purpose}</b>
                  <small>
                    {item.customer} · {dueText(item.dueAt)}
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
