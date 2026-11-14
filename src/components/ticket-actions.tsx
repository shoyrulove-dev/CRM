"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TicketActions({ id, status, resolution }: { id: string; status: string; resolution?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function update(nextStatus: string) {
    if (nextStatus === "Đã đóng" && !resolution) {
      alert("Vui lòng chọn hướng xử lý trong chi tiết phiếu trước khi đóng.");
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setLoading(false);
    if (response.ok) router.refresh();
    else alert("Không thể cập nhật phiếu.");
  }
  return (
    <select
      className="ghost-select"
      disabled={loading || status === "Đã đóng"}
      value={status}
      onChange={(event) => update(event.target.value)}
    >
      <option>Mới</option>
      <option>Đang xử lý</option>
      <option>Chờ khách</option>
      <option>Đã đóng</option>
    </select>
  );
}
