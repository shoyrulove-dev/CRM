"use client";
import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
export function ActivityActions({ id, note }: { id: string; note?: string }) {
  const router = useRouter();
  async function edit() {
    const value = prompt("Cập nhật ghi chú chăm sóc", note || "");
    if (value === null) return;
    const r = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: value }),
    });
    if (r.ok) router.refresh();
    else alert((await r.json()).error);
  }
  async function remove() {
    if (!confirm("Xóa nhật ký chăm sóc này?")) return;
    const r = await fetch(`/api/activities/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
    else alert((await r.json()).error);
  }
  return (
    <span className="activity-actions">
      <button onClick={edit} title="Sửa ghi chú">
        <Pencil size={13} />
      </button>
      <button onClick={remove} title="Xóa nhật ký">
        <Trash2 size={13} />
      </button>
    </span>
  );
}
