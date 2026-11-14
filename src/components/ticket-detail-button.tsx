"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { ServiceTicket } from "@/lib/types";

const resolutions = ["Thu hàng - Hoàn tiền", "Đổi hàng", "Điều chỉnh cách dùng", "Khác"];

export function TicketDetailButton({ ticket, phone }: { ticket: ServiceTicket; phone: string }) {
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const router = useRouter(), locked = ticket.status === "Đã đóng";
  async function patch(body: object) {
    setLoading(true); setError("");
    const response = await fetch(`/api/tickets/${encodeURIComponent(ticket.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json().catch(() => ({})); setLoading(false);
    if (!response.ok) { setError(json.error || "Không thể cập nhật phiếu."); return false; }
    router.refresh(); return true;
  }
  async function saveResolution(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await patch({ resolution: new FormData(event.currentTarget).get("resolution") }); }
  async function addNote(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; if (await patch({ note: new FormData(form).get("note") })) form.reset(); }
  return <><button type="button" className="text-button" onClick={() => setOpen(true)}>{ticket.id}</button>{open && <Modal title={`Phiếu ${ticket.id}`} description={ticket.title} onClose={() => setOpen(false)}>
    <dl className="detail-list">
      <div><dt>Khách hàng</dt><dd>{ticket.customer} · {phone || "Chưa có số"}</dd></div><div><dt>Trạng thái</dt><dd>{ticket.status}</dd></div>
      <div><dt>Ưu tiên</dt><dd>{ticket.priority}</dd></div><div><dt>Phụ trách</dt><dd>{ticket.owner}</dd></div>
      <div><dt>Hướng xử lý</dt><dd>{ticket.resolution || "Chưa chọn"}</dd></div><div><dt>Đơn hàng</dt><dd>{ticket.orderCode || "Không gắn đơn"}</dd></div>
      <div><dt>Sản phẩm thu/đổi</dt><dd>{ticket.returnProductName ? `${ticket.returnProductName} · SL ${ticket.returnQuantity || 1}` : "Không có"}</dd></div>
      <div><dt>Sản phẩm đổi sang</dt><dd>{ticket.exchangeProductName ? `${ticket.exchangeProductName} · SL ${ticket.exchangeQuantity || 1}` : "Không có"}</dd></div>
      <div><dt>Mô tả</dt><dd>{ticket.description || "Không có ghi chú"}</dd></div><div><dt>Ngày tạo</dt><dd>{new Date(ticket.createdAt).toLocaleString("vi-VN")}</dd></div>
    </dl>
    {!locked && <form className="entity-form" onSubmit={saveResolution}><label>Hướng xử lý<select name="resolution" defaultValue={ticket.resolution || ""} required><option value="" disabled>Chọn hướng xử lý</option>{resolutions.map((item) => <option key={item}>{item}</option>)}</select></label><button className="secondary-button" disabled={loading}>Lưu hướng xử lý</button></form>}
    <section className="ticket-history"><h3>Lịch sử cập nhật</h3>{ticket.updates?.length ? ticket.updates.map((item) => <article key={item.id}><b>{item.author}</b><time>{new Date(item.createdAt).toLocaleString("vi-VN")}</time><p>{item.content}</p></article>) : <p>Chưa có nội dung cập nhật.</p>}</section>
    {!locked && <form className="entity-form" onSubmit={addNote}><label>Nội dung cập nhật<textarea name="note" maxLength={1000} required placeholder="Ghi lại kết quả trao đổi hoặc việc đã xử lý..." /></label><button className="primary-button" disabled={loading}>Thêm cập nhật</button></form>}
    {locked && <p className="form-note">Phiếu đã đóng và được khóa để bảo toàn lịch sử xử lý.</p>}{error && <p className="form-error">{error}</p>}
    <footer><button className="secondary-button" onClick={() => setOpen(false)}>Đóng</button></footer>
  </Modal>}</>;
}
