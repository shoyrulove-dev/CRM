"use client";
import { FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { customerSegments, healthGoals, normalizeClassification } from "@/lib/customer-options";

export function CustomerClassificationEditor({ id, segment, healthGoal, advisoryNote }: { id: string; segment: string; healthGoal: string; advisoryNote?: string }) {
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const router = useRouter();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch(`/api/customers/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(values) });
      const json = await response.json();
      if (!response.ok) { setError(json.error || "Không thể cập nhật khách hàng."); return; }
      setOpen(false); router.refresh();
    } catch { setError("Kết nối gián đoạn. Vui lòng thử lại."); }
    finally { setLoading(false); }
  }
  return <><button className="icon-action" title="Cập nhật phân nhóm" aria-label="Cập nhật phân nhóm" onClick={() => setOpen(true)}><Pencil size={16} /></button>
    {open && <Modal title="Cập nhật phân nhóm" description="Chọn theo thông tin đã trao đổi với khách hàng." onClose={() => setOpen(false)}><form className="entity-form" onSubmit={save}><div className="form-grid">
      <label className="full">Phân nhóm<select name="segment" defaultValue={normalizeClassification(segment) || "Chưa xác định"}>{Array.from(new Set([...customerSegments, ...(segment ? [normalizeClassification(segment)] : [])])).map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="full">Mục tiêu sức khỏe<select name="healthGoal" defaultValue={normalizeClassification(healthGoal) || "Chưa xác định"}>{Array.from(new Set([...healthGoals, ...(healthGoal ? [normalizeClassification(healthGoal)] : [])])).map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="full">Lưu ý tư vấn<textarea name="advisoryNote" defaultValue={advisoryNote} rows={4} maxLength={2000} /></label>
    </div>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button><button className="primary-button" disabled={loading}>{loading ? "Đang lưu..." : "Lưu thay đổi"}</button></footer></form></Modal>}
  </>;
}
