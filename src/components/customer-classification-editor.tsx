"use client";
import { FormEvent, useState } from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";

export function CustomerClassificationEditor({ id, segment, healthGoal }: { id: string; segment: string; healthGoal: string }) {
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
      <label className="full">Phân nhóm<input name="segment" list={`segments-${id}`} defaultValue={segment || "Chưa xác định"} required maxLength={80} /><datalist id={`segments-${id}`}>{["Chưa xác định", "Khách mới", "Khách trung thành", "Đang theo liệu trình", "Cần kéo lại"].map((value) => <option key={value} value={value} />)}</datalist></label>
      <label className="full">Mục tiêu sức khỏe<input name="healthGoal" list={`goals-${id}`} defaultValue={healthGoal || "Chưa xác định"} required maxLength={120} /><datalist id={`goals-${id}`}>{["Chưa xác định", "Tiêu hóa", "Xương khớp", "Tim mạch", "Da - làm đẹp", "Miễn dịch", "Khác"].map((value) => <option key={value} value={value} />)}</datalist></label>
    </div>{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button><button className="primary-button" disabled={loading}>{loading ? "Đang lưu..." : "Lưu thay đổi"}</button></footer></form></Modal>}
  </>;
}
