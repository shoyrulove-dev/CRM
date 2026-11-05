"use client";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function CareTaskActions({ id, status }: { id: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function complete() {
    setLoading(true);
    const response = await fetch(`/api/care/${encodeURIComponent(id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "done" }),
    });
    setLoading(false);
    if (response.ok) router.refresh(); else alert("Không thể cập nhật nhiệm vụ. Vui lòng thử lại.");
  }
  return <button className="secondary-button" disabled={loading || status === "done"} onClick={complete}>
    <CheckCircle2 size={15}/>{status === "done" ? "Đã hoàn thành" : loading ? "Đang lưu..." : "Hoàn thành"}
  </button>;
}
