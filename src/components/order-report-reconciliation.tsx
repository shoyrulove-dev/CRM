"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { OrderReportAdjustment } from "@/lib/order-report-adjustment";
import type { SalesOrder } from "@/lib/types";

export function OrderReportReconciliation({ id, code, date, status, adjustment }: {
  id: string; code: string; date: string; status: SalesOrder["status"]; adjustment?: OrderReportAdjustment;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "reset" ? "reset" : "save";
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/reports/orders/${encodeURIComponent(id)}/adjustment`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, reason: form.get("reason"), date: form.get("date"), status: form.get("status"),
          excluded: form.get("excluded") === "on", expectedDate: date, expectedStatus: status, expectedAt: adjustment?.at || "" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Không thể lưu điều chỉnh.");
      setOpen(false); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lưu điều chỉnh."); }
    finally { setBusy(false); }
  }
  const comparisons = [
    ["Ngày tính", date || "—", (adjustment?.date ?? date) || "—"],
    ["Trạng thái", status, adjustment?.status ?? status],
    ["Phạm vi báo cáo", "Theo trạng thái nguồn", adjustment?.excluded ? "Đã loại khỏi báo cáo" : "Theo trạng thái đang dùng"],
  ];
  return <>
    <button type="button" className="secondary-button" onClick={() => { setError(""); setOpen(true); }}>Đối soát</button>
    {open && <Modal title={`Đối soát đơn ${code}`} description="Điều chỉnh dùng cho báo cáo CRM. Dữ liệu gốc được giữ để so sánh." onClose={() => { if (!busy) setOpen(false); }}>
      <div className="entity-form">
        <div className="table-wrap"><table>
          <thead><tr><th>Thông tin</th><th>Gốc Haravan</th><th>Dùng trong báo cáo</th><th>Chênh lệch</th></tr></thead>
          <tbody>{comparisons.map(([label, source, current], i) => <tr key={label}><th scope="row">{label}</th><td>{source}</td><td>{current}</td>
            <td>{(i === 2 ? adjustment?.excluded : source !== current) ? "Có điều chỉnh" : "—"}</td></tr>)}</tbody>
        </table></div>
        {adjustment && <p>{adjustment.editor} · {new Date(adjustment.at).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })} · {adjustment.reason}
          {(adjustment.sourceDate !== date || adjustment.sourceStatus !== status) && <strong> · Nguồn đã đổi, cần rà lại</strong>}</p>}
        <form className="entity-form" onSubmit={save}>
          <label>Ngày tính báo cáo<input type="date" name="date" defaultValue={adjustment?.date ?? date} required /></label>
          <label>Trạng thái tính báo cáo<select name="status" defaultValue={adjustment?.status ?? status}><option>Mua hàng</option><option>Trả hàng</option><option>Hủy</option></select></label>
          <label className="check-label"><input type="checkbox" name="excluded" defaultChecked={adjustment?.excluded} />Loại đơn khỏi báo cáo</label>
          <label>Lý do<textarea name="reason" required minLength={3} maxLength={500} rows={3} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <footer>
            {adjustment && <button className="secondary-button" value="reset" disabled={busy} formNoValidate>Trả về Haravan</button>}
            <button className="primary-button" value="save" disabled={busy}>{busy ? "Đang lưu…" : "Lưu điều chỉnh"}</button>
          </footer>
        </form>
      </div>
    </Modal>}
  </>;
}
