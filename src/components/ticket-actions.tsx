"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TicketActions({ id, status }: { id: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function update(nextStatus: string) {
    setLoading(true);
    const response = await fetch(`/api/tickets/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    setLoading(false);
    if (response.ok) router.refresh(); else alert("Không thể cập nhật phiếu.");
  }
  return <select className="ghost-select" disabled={loading} value={status} onChange={event => update(event.target.value)}>
    <option>Mới</option><option>Đang xử lý</option><option>Chờ khách</option><option>Đã đóng</option>
  </select>;
}
