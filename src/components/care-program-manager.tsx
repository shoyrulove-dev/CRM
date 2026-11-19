"use client";
import { useState } from "react";
import { Modal } from "./modal";
import { recurrenceOptions } from "@/lib/care-recurrence";
import { defaultCareAutomation } from "@/lib/care-automation-defaults";
type Program = { id: string; purpose: string; channel: string; owner: string; assignToCustomerOwner: boolean; targetCount: number; created: number; skipped: number; cursor: number; nextDueAt: string; status: string; recurrence: keyof typeof recurrenceOptions; intervalDays: number; endDate: string; error?: string };
export function CareProgramManager() {
  const [open, setOpen] = useState(false), [items, setItems] = useState<Program[]>([]), [page, setPage] = useState(1), [pages, setPages] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [automation, setAutomation] = useState(defaultCareAutomation), [editing, setEditing] = useState<Program | null>(null);
  async function load(next = page) {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/care/programs?page=${next}`, { cache: "no-store" }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setItems(json.items); setPage(json.page); setPages(json.pages); setAutomation(json.automation); }
    catch (e) { setError(e instanceof Error ? e.message : "Không thể tải chương trình."); } finally { setBusy(false); }
  }
  async function change(data: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { const r = await fetch("/api/care/programs", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); const j = await r.json(); if (!r.ok) throw new Error(j.error); setEditing(null); setNotice("Đã lưu. Thay đổi áp dụng cho lịch chưa tạo; lịch đã giao vẫn được giữ để đối chiếu."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Chưa lưu được."); } finally { setBusy(false); }
  }
  return <><button className="secondary-button" onClick={() => { setOpen(true); void load(1); }}>Chương trình chăm sóc</button>
    {open && <Modal title="Chương trình chăm sóc" description="Xem, sửa, tạm dừng hoặc kết thúc chương trình. Tệp khách được chốt khi tạo; người phụ trách được lấy lại từ hồ sơ ở mỗi lượt." onClose={() => setOpen(false)}>
      <div className="entity-form">{error && <p className="form-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
        <button type="button" className="secondary-button" disabled={busy} onClick={() => void load()}>Làm mới tiến độ</button>
        <div className="table-wrap"><table><thead><tr><th>Nội dung</th><th>Giao việc</th><th>Tiến độ</th><th>Lượt tiếp theo</th><th>Thao tác</th></tr></thead><tbody>
          {items.map(p => <tr key={p.id}><td><strong>{p.purpose}</strong><small>{recurrenceOptions[p.recurrence]} · {p.status === "active" ? "Đang chạy" : p.status === "paused" ? "Tạm dừng" : p.status === "ended" ? "Đã kết thúc" : "Hoàn tất"}</small>{p.error && <small className="danger-text">{p.error}</small>}</td><td>{p.assignToCustomerOwner ? "Theo hồ sơ khách" : p.owner}</td><td>{p.targetCount} khách · {p.created} lịch đã tạo · {p.skipped} bỏ qua<small>Đang xử lý: {p.cursor}/{p.targetCount}</small></td><td>{new Date(p.nextDueAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}</td><td><button className="secondary-button" disabled={busy} onClick={() => setEditing(p)}>Sửa</button>{["active", "paused"].includes(p.status) && <><button className="secondary-button" disabled={busy} onClick={() => void change({ id: p.id, status: p.status === "active" ? "paused" : "active" })}>{p.status === "active" ? "Tạm dừng" : "Tiếp tục"}</button><button className="secondary-button" disabled={busy} onClick={() => { if (confirm("Kết thúc chương trình, không tạo thêm lịch? Các lịch đã giao vẫn được giữ.")) void change({ id: p.id, status: "ended" }); }}>Kết thúc</button></>}</td></tr>)}
        </tbody></table></div>{!items.length && <p>Chưa có chương trình. Chọn Tạo hàng loạt để bắt đầu.</p>}
        <div className="page-actions"><button className="secondary-button" disabled={busy || page <= 1} onClick={() => void load(page - 1)}>Trước</button><span>{page}/{pages}</span><button className="secondary-button" disabled={busy || page >= pages} onClick={() => void load(page + 1)}>Sau</button></div>
        {editing && <form className="entity-form" onSubmit={event => { event.preventDefault(); void change({ ...Object.fromEntries(new FormData(event.currentTarget)), id: editing.id }); }}><h3>Sửa chương trình</h3><label>Nội dung<input name="purpose" required defaultValue={editing.purpose} /></label><label>Lặp lại<select name="recurrence" defaultValue={editing.recurrence}>{Object.entries(recurrenceOptions).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>Số ngày tùy chỉnh<input name="intervalDays" type="number" min="1" max="3650" defaultValue={editing.intervalDays} /></label><label>Ngày kết thúc<input type="date" name="endDate" defaultValue={editing.endDate} /></label><footer><button type="button" className="secondary-button" onClick={() => setEditing(null)}>Hủy sửa</button><button className="primary-button" disabled={busy}>Lưu chương trình</button></footer></form>}
        <details><summary>Cài đặt lịch tự động từ đơn hàng, sinh nhật và ngày lễ</summary><p>Chỉ tạo lịch từ mốc áp dụng. Tắt nguồn không xóa lịch đã giao. Sinh nhật dùng ngày sinh trong hồ sơ; ngày lễ có sẵn gồm 1/1, 8/3, 30/4, 1/5, 2/9, 20/10, 25/12 và Tết. Dịp riêng có thể tạo bằng chương trình hàng loạt.</p>
          <label><input type="checkbox" checked={automation.orders} onChange={e => setAutomation({ ...automation, orders: e.target.checked })} />Theo đơn hàng</label>
          <label><input type="checkbox" checked={automation.birthdays} onChange={e => setAutomation({ ...automation, birthdays: e.target.checked })} />Sinh nhật</label>
          <label><input type="checkbox" checked={automation.holidays} onChange={e => setAutomation({ ...automation, holidays: e.target.checked })} />Ngày lễ</label>
          <label>Áp dụng lịch mới từ ngày<input type="date" value={automation.activeFrom?.slice(0, 10) || ""} onChange={e => setAutomation({ ...automation, activeFrom: e.target.value ? `${e.target.value}T00:00:00+07:00` : "" })} /></label>
          {automation.orderRules.map((rule, index) => <div className="form-grid" key={index}><label>Số ngày sau mua<input type="number" min="0" max="3650" value={rule.offset} onChange={e => setAutomation({ ...automation, orderRules: automation.orderRules.map((r, i) => i === index ? { ...r, offset: Number(e.target.value) } : r) })} /></label><label>Nội dung<input value={rule.purpose} onChange={e => setAutomation({ ...automation, orderRules: automation.orderRules.map((r, i) => i === index ? { ...r, purpose: e.target.value } : r) })} /></label><label>Kênh<select value={rule.channel} onChange={e => setAutomation({ ...automation, orderRules: automation.orderRules.map((r, i) => i === index ? { ...r, channel: e.target.value } : r) })}>{["Gọi điện", "Zalo", "Facebook", "SMS", "Trực tiếp"].map(v => <option key={v}>{v}</option>)}</select></label><button className="secondary-button" onClick={() => setAutomation({ ...automation, orderRules: automation.orderRules.filter((_, i) => i !== index) })}>Bỏ nội dung này</button></div>)}
          <button className="secondary-button" onClick={() => setAutomation({ ...automation, orderRules: [...automation.orderRules, { offset: 7, purpose: "Chăm sóc sau mua", channel: "Gọi điện" }] })}>Thêm nội dung</button><button className="primary-button" disabled={busy} onClick={() => void change({ ...automation, id: "care_automation" })}>Lưu lịch tự động</button>
        </details>
      </div>
    </Modal>}
  </>;
}
