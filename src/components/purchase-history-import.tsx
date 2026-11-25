"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";

type Preview = {
  id: string; matched: number; ambiguous: number; unmatched: number; changed: number;
  beforeRevenue: number; afterRevenue: number;
  validation: { rows: number; invalidPhone: number; invalidDate: number; afterCutoff: number; missingOrder: number; missingSku: number };
  sample: { code: string; day: string; employee: string; amount: number; before: string; after: string; beforeRepeat: boolean; afterRepeat: boolean }[];
};
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

export function PurchaseHistoryImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const endpoint = "/api/reports/purchase-history";

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setPreview(null);
    setConfirmed(false);
    try {
      const response = await fetch(endpoint, { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể đọc tệp.");
      setPreview(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đọc tệp.");
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!preview || !confirmed || !preview.matched || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${endpoint}?action=approve`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: preview.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể áp dụng dữ liệu.");
      setNotice(`Đã áp dụng lịch sử mua cho ${preview.matched} khách khớp.`);
      setPreview(null);
      setConfirmed(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể áp dụng dữ liệu.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="secondary-button" onClick={() => setOpen(true)}>Nhập lịch sử mua</button>
    {open && <Modal title="Nhập lịch sử mua" description="Dùng SĐT để ghép với hồ sơ CRM. Mã đơn và SKU dùng để xác định sản phẩm trong đơn đầu tiên." onClose={() => { if (!busy) setOpen(false); }}>
      <div className="entity-form">
        <form className="entity-form" onSubmit={upload}>
          <label>Tệp Excel (.xlsx)<input name="file" type="file" accept=".xlsx" required disabled={busy} onChange={() => { setPreview(null); setConfirmed(false); }} /></label>
          <label>Nhập lịch sử đến hết ngày<input name="cutoff" type="date" defaultValue="2025-10-31" required disabled={busy} onChange={() => { setPreview(null); setConfirmed(false); }} /></label>
          <p>Tối đa 10 MB hoặc 100.000 dòng mỗi tệp. Chia tệp theo tháng và giữ đủ các dòng của từng đơn.</p>
          <button className="secondary-button" disabled={busy}>{busy ? "Đang xử lý…" : "Xem trước và đối chiếu"}</button>
        </form>
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {preview && <>
          <p>{preview.validation.rows} dòng · {preview.matched} khách khớp duy nhất · {preview.ambiguous} SĐT khớp nhiều hồ sơ · {preview.unmatched} SĐT chưa khớp</p>
          <p>{preview.validation.invalidPhone} dòng sai SĐT · {preview.validation.invalidDate} dòng sai ngày · {preview.validation.afterCutoff} dòng sau mốc · {preview.validation.missingOrder} dòng thiếu mã đơn · {preview.validation.missingSku} dòng thiếu SKU</p>
          <p>{preview.changed} đơn đổi phân loại. Doanh thu mua lại trong dữ liệu CRM từ {vnd.format(preview.beforeRevenue)} thành {vnd.format(preview.afterRevenue)}.</p>
          {preview.sample.length > 0 && <div className="table-wrap"><table>
            <thead><tr><th>Đơn</th><th>Ngày</th><th>Trước</th><th>Sau</th></tr></thead>
            <tbody>{preview.sample.map((row, index) => <tr key={index}><td>{row.code}</td><td>{row.day}</td>
              <td>{row.beforeRepeat ? "Mua lại · " : ""}{row.before}</td><td>{row.afterRepeat ? "Mua lại · " : ""}{row.after}</td></tr>)}</tbody>
          </table></div>}
          {!!preview.matched && <>
            <label className="check-label"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />Tôi đã rà số liệu và đồng ý áp dụng lịch sử mua cho khách khớp duy nhất.</label>
            <button className="primary-button" type="button" disabled={busy || !confirmed} onClick={approve}>Áp dụng lịch sử mua</button>
          </>}
        </>}
      </div>
    </Modal>}
  </>;
}
