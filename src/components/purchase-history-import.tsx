"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { HistoryCells } from "../../scripts/preview-purchase-history.cjs";

type Preview = {
  id: string; matched: number; ambiguous: number; unmatched: number; changed: number;
  beforeRevenue: number; afterRevenue: number;
  validation: { rows: number; invalidPhone: number; invalidDate: number; afterCutoff: number; missingOrder: number; missingSku: number;
    hasOrderColumn: boolean; hasSkuColumn: boolean; sampleIssues: { row: number; issues: string[]; values?: HistoryCells }[] };
  choices: { phone: string; customers: { id: string; name: string }[] }[];
  sample: { code: string; day: string; employee: string; amount: number; before: string; after: string; beforeRepeat: boolean; afterRepeat: boolean }[];
};
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const issueLabels: Record<string, string> = {
  invalid_phone: "SĐT trống hoặc sai định dạng. Kiểm tra số gốc trong Excel.",
  invalid_date: "Ngày mua không hợp lệ. Dùng ngày Excel hoặc dạng dd/mm/yyyy.",
  after_cutoff: "Ngày mua sau mốc đã chọn. Kiểm tra ngày hoặc mốc nhập.",
  missing_order: "Thiếu mã đơn hoặc số chứng từ.",
  missing_sku: "Thiếu SKU hoặc mã hàng.",
};
const columns = [
  { key: "phone", label: "SĐT", errors: ["invalid_phone"], color: "#fee2e2" },
  { key: "date", label: "Ngày mua", errors: ["invalid_date", "after_cutoff"], color: "#fee2e2" },
  { key: "order", label: "Mã đơn", errors: ["missing_order"], color: "#fef3c7" },
  { key: "sku", label: "SKU", errors: ["missing_sku"], color: "#fef3c7" },
] as const;

export function PurchaseHistoryImport() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"preview" | "apply" | null>(null);
  const busy = step !== null;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [edits, setEdits] = useState<Record<string, Partial<HistoryCells>>>({});
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const endpoint = "/api/reports/purchase-history";

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep("preview");
    setError("");
    setNotice("");
    setConfirmed(false);
    try {
      const body = new FormData(event.currentTarget);
      body.set("edits", JSON.stringify(edits));
      body.set("matches", JSON.stringify(matches));
      const response = await fetch(endpoint, { method: "POST", body });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) throw new Error(data?.error || (response.status === 413 ? "Tệp quá lớn. Chia theo tháng rồi tải lại." : response.status === 401 ? "Phiên đăng nhập đã hết. Đăng nhập lại rồi tải tệp." : "CRM chưa trả được kết quả xem trước. Vui lòng thử lại."));
      setPreview(data);
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đọc tệp.");
    } finally {
      setStep(null);
    }
  }

  async function approve() {
    if (!preview || dirty || !confirmed || !preview.matched || busy) return;
    setStep("apply");
    setError("");
    try {
      const response = await fetch(`${endpoint}?action=approve`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: preview.id }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error || (response.status === 401 ? "Phiên đăng nhập đã hết. Đăng nhập lại rồi xem trước tệp." : "Chưa xác nhận được kết quả áp dụng. Bấm lại để kiểm tra lượt nhập này."));
      setNotice(`Đã áp dụng lịch sử mua cho ${preview.matched} khách khớp.`);
      setPreview(null);
      setConfirmed(false);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể áp dụng dữ liệu.");
    } finally {
      setStep(null);
    }
  }

  return <>
    <button type="button" className="secondary-button" onClick={() => {
      setPreview(null); setEdits({}); setMatches({}); setDirty(false); setConfirmed(false); setError(""); setNotice(""); setOpen(true);
    }}>Nhập lịch sử mua</button>
    {open && <Modal title="Nhập lịch sử mua" description="Dùng SĐT để ghép với hồ sơ CRM. Mã đơn và SKU dùng để xác định sản phẩm trong đơn đầu tiên." onClose={() => { if (!busy) setOpen(false); }}>
      <div className="entity-form">
        <form className="entity-form" onSubmit={upload}>
          <label>Tệp Excel (.xlsx)<input name="file" type="file" accept=".xlsx" required disabled={busy} onChange={() => { setPreview(null); setConfirmed(false); setEdits({}); setMatches({}); setDirty(false); }} /></label>
          <label>Nhập lịch sử đến hết ngày<input name="cutoff" type="date" defaultValue="2025-10-31" required disabled={busy} onChange={() => { setPreview(null); setConfirmed(false); }} /></label>
          <p>Tối đa 10 MB hoặc 100.000 dòng mỗi tệp. Chia tệp theo tháng và giữ đủ các dòng của từng đơn.</p>
          <button className="secondary-button" disabled={busy}>{preview ? "Đối chiếu lại" : "Xem trước và đối chiếu"}</button>
        </form>
        {step && <p role="status">{step === "preview" ? "Đang đọc Excel và đối chiếu với CRM…" : "Đang áp dụng lịch sử mua…"}</p>}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
        {preview && <>
          <p role="status">{preview.matched ? "Đã đối chiếu · Chờ xác nhận áp dụng" : "Không có khách khớp duy nhất để áp dụng. Kiểm tra SĐT trong file và hồ sơ CRM."}</p>
          <p>{preview.validation.rows} dòng · {preview.matched} khách khớp duy nhất · {preview.ambiguous} SĐT khớp nhiều hồ sơ · {preview.unmatched} SĐT chưa khớp</p>
          <p>{preview.validation.invalidPhone} dòng sai SĐT · {preview.validation.invalidDate} dòng sai ngày · {preview.validation.afterCutoff} dòng sau mốc · {preview.validation.missingOrder} dòng thiếu mã đơn · {preview.validation.missingSku} dòng thiếu SKU</p>
          {(!preview.validation.hasOrderColumn || !preview.validation.hasSkuColumn) && <p>Thiếu {[
            !preview.validation.hasOrderColumn && "cột Mã đơn",
            !preview.validation.hasSkuColumn && "cột SKU",
          ].filter(Boolean).join(" và ")}. CRM vẫn có thể nhận diện khách cũ qua SĐT. Bổ sung cột còn thiếu để đối chiếu sản phẩm.</p>}
          {preview.validation.sampleIssues.length > 0 && <details open>
            <summary>Chi tiết các dòng cần kiểm tra (tối đa 20 dòng đầu)</summary>
            <div className="table-wrap"><table>
              <thead><tr><th>Dòng</th>{columns.map(col => <th key={col.key}>{col.label}</th>)}<th>Kết quả</th></tr></thead>
              <tbody>{preview.validation.sampleIssues.map(({ row, issues, values }) => <tr key={row}>
                <td>{row}</td>
                {columns.map(col => {
                  const issue = issues.find(value => (col.errors as readonly string[]).includes(value));
                  return <td key={col.key} style={{ background: issue ? col.color : edits[row]?.[col.key] !== undefined && !dirty ? "#dcfce7" : undefined }}>
                    <input aria-label={`${col.label} dòng ${row}`} aria-invalid={issue ? true : undefined} title={issue ? issueLabels[issue] : undefined}
                      size={12} maxLength={120} disabled={busy} value={edits[row]?.[col.key] ?? values?.[col.key] ?? ""}
                      onChange={e => { const value = e.target.value; setEdits(current => ({ ...current, [row]: { ...current[row], [col.key]: value } })); setDirty(true); setConfirmed(false); }} />
                  </td>;
                })}
                <td>{issues.length ? issues.map(issue => issueLabels[issue] || issue).join(" ") : "Hợp lệ"}</td>
              </tr>)}</tbody>
            </table></div>
          </details>}
          {preview.choices.map(({ phone, customers }) => <label key={phone}>SĐT {phone} khớp nhiều hồ sơ
            <select disabled={busy} value={matches[phone] || ""} onChange={e => { const value = e.target.value; setMatches(current => ({ ...current, [phone]: value })); setDirty(true); setConfirmed(false); }}>
              <option value="">Bỏ qua số này</option>
              {customers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} · {customer.id}</option>)}
            </select>
          </label>)}
          {dirty && <p role="status">Có thay đổi chưa kiểm tra. Bấm Đối chiếu lại để cập nhật kết quả.</p>}
          <p>{preview.changed} đơn đổi phân loại. Doanh thu mua lại trong dữ liệu CRM từ {vnd.format(preview.beforeRevenue)} thành {vnd.format(preview.afterRevenue)}.</p>
          {preview.sample.length > 0 && <div className="table-wrap"><table>
            <thead><tr><th>Đơn</th><th>Ngày</th><th>Trước</th><th>Sau</th></tr></thead>
            <tbody>{preview.sample.map((row, index) => <tr key={index}><td>{row.code}</td><td>{row.day}</td>
              <td>{row.beforeRepeat ? "Mua lại · " : ""}{row.before}</td><td>{row.afterRepeat ? "Mua lại · " : ""}{row.after}</td></tr>)}</tbody>
          </table></div>}
          {!!preview.matched && <>
            <label className="check-label"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} />Tôi đã rà số liệu và đồng ý áp dụng lịch sử mua cho khách khớp duy nhất.</label>
            <button className="primary-button" type="button" disabled={busy || dirty || !confirmed} onClick={approve}>Áp dụng lịch sử mua</button>
          </>}
        </>}
      </div>
    </Modal>}
  </>;
}
