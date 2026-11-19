"use client";
import { Upload } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { CareImportRow } from "@/lib/care-import";

type Preview = { batchId: string; expiresAt: string; rows: CareImportRow[] };
type Result = { inserted: number; skipped: number; results: Array<{ row: number; status: string; message: string }> };
const labels = { ready: "Sẵn sàng", warning: "Cần xác nhận", error: "Không thể nhập", duplicate: "Nghi trùng — bỏ qua" };
export function ImportCareButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false), [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null), [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<number[]>([]), [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const warningsSelected = preview?.rows.some(row => selected.includes(row.row) && row.status === "warning");
  function start() { setOpen(true); setFile(null); setPreview(null); setResult(null); setSelected([]); setError(""); setAcknowledged(false); }
  async function inspect() {
    if (!file || busy) return;
    setBusy(true); setError(""); setResult(null); setPreview(null);
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/activities/import", { method: "POST", body, signal: AbortSignal.timeout(120_000) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Không thể kiểm tra file.");
      const data = json.data as Preview; setPreview(data);
      // Warnings require an explicit per-row choice; only clean rows are preselected.
      setSelected(data.rows.filter(row => row.status === "ready").map(row => row.row));
      setAcknowledged(false);
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể đọc file Excel."); }
    finally { setBusy(false); }
  }
  async function commit() {
    if (!preview || busy || !selected.length) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/activities/import", { method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ batchId: preview.batchId, rows: selected, acknowledgeWarnings: acknowledged }),
        signal: AbortSignal.timeout(120_000) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Không thể xác nhận nhập.");
      setResult(json.data); router.refresh();
    } catch (error) { setError((error instanceof Error ? error.message : "Không thể nhập dữ liệu.") + " Có thể thử lại; hệ thống chống tạo trùng."); }
    finally { setBusy(false); }
  }
  function downloadReport() {
    if (!preview) return;
    const results = new Map(result?.results.map(row => [row.row, row]) || []);
    const rows = [["Dòng Excel", "Khách CRM", "SĐT", "Trạng thái", "Chi tiết"], ...preview.rows.map(row => [
      row.row, row.customerName || row.name, row.phone, results.get(row.row)?.status || labels[row.status],
      [results.get(row.row)?.message, ...row.errors, ...row.warnings].filter(Boolean).join("; "),
    ])];
    const cell = (value: unknown) => { const text = String(value ?? ""); return '"' + (/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"'; };
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "ket-qua-import-cskh.csv"; link.click(); URL.revokeObjectURL(url);
  }
  return <>
    <button className="secondary-button" onClick={start}><Upload size={16} />Import Excel CSKH</button>
    {open && <Modal title="Import lịch sử CSKH từ Excel" description="Chỉ thêm nhật ký cho khách đã có; đối chiếu bằng số điện thoại. Không sửa hồ sơ, người phụ trách, lịch hẹn hoặc Loyalty."
      onClose={() => { if (!busy) setOpen(false); }}>
      <div className="care-import">
        <div className="care-import-upload">
          <label>File Excel theo mẫu (.xlsx, tối đa 2 MB / 500 dòng)
            <input type="file" accept=".xlsx" disabled={busy} onChange={event => {
              setFile(event.target.files?.[0] || null); setPreview(null); setResult(null); setSelected([]); setError("");
            }} /></label>
          <a className="secondary-button" href="/api/activities/import" download="mau-nhap-lich-su-cskh.xlsx">Tải file mẫu</a>
          <button className="primary-button" disabled={!file || busy} onClick={inspect}>{busy && !preview ? "Đang kiểm tra..." : "Kiểm tra và xem trước"}</button>
        </div>
        <p>Không tự tạo khách mới. SĐT không tìm thấy/trùng nhiều khách hoặc nhân viên không hợp lệ sẽ bị chặn. Dòng cảnh báo cần chọn và xác nhận riêng.</p>
        {error && <p role="alert" className="danger-text">{error}</p>}
        {preview && <>
          <div className="care-import-summary">{preview.rows.length} dòng · {preview.rows.filter(row => row.status === "ready").length} sẵn sàng · {preview.rows.filter(row => row.status === "warning").length} cảnh báo · {preview.rows.filter(row => row.status === "error").length} lỗi · {preview.rows.filter(row => row.status === "duplicate").length} nghi trùng</div>
          <div className="table-wrap care-import-table"><table><thead><tr><th>Chọn</th><th>Dòng</th><th>Khách / SĐT</th><th>Ngày / Nhân viên</th><th>Nội dung</th><th>Đối chiếu</th></tr></thead><tbody>
            {preview.rows.map(row => <tr key={row.row}>
              <td><input type="checkbox" aria-label={`Chọn dòng ${row.row}`} disabled={busy || !!result || !["ready", "warning"].includes(row.status)}
                checked={selected.includes(row.row)} onChange={event => setSelected(current => event.target.checked ? [...current, row.row] : current.filter(n => n !== row.row))} /></td>
              <td>{row.row}</td><td><strong>{row.customerName || row.name}</strong><br />{row.phone}<small>Excel: {row.name}<br />CRM: {row.customerId || "Chưa tìm thấy"}<br />Phụ trách: {row.customerOwner || "—"}</small></td>
              <td>{row.data.occurredAt ? new Date(row.data.occurredAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok", ...(row.data.dateOnly ? { year: "numeric", month: "2-digit", day: "2-digit" } : {}) }) : "Ngày lỗi"}<br />{row.data.employee}</td>
              <td>{row.data.channel} · {row.data.purpose}<br />{row.data.result}<small>{row.data.note || "Không có ghi chú"}</small></td>
              <td><b>{labels[row.status]}</b>{[...row.errors, ...row.warnings].map((message, index) => <small key={index}>{message}</small>)}</td>
            </tr>)}
          </tbody></table></div>
          {!result && <>
            <div className="page-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => setSelected(preview.rows.filter(row => ["ready", "warning"].includes(row.status)).map(row => row.row))}>Chọn tất cả dòng có thể nhập</button><button type="button" className="secondary-button" disabled={busy} onClick={() => setSelected([])}>Bỏ chọn tất cả</button></div>
            {!selected.length && <p role="status">Chưa chọn dòng dữ liệu. Tích ô Chọn ở từng dòng hoặc dùng Chọn tất cả, sau đó xác nhận các dòng cảnh báo.</p>}
            <label className="check-label"><input type="checkbox" disabled={busy} checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />Tôi đã kiểm tra đúng khách, ngày, nhân viên và chấp nhận các dòng cảnh báo được chọn.</label>
            <p>Chỉ thêm lịch sử. Không tự đổi ngày chăm gần nhất, lịch chăm sắp tới hay tạo đơn hàng. Bản xem trước hết hạn sau 30 phút.</p>
            <button className="primary-button" disabled={busy || !selected.length || (!!warningsSelected && !acknowledged)} onClick={commit}>
              {busy ? "Đang nhập..." : `Xác nhận nhập ${selected.length} dòng`}</button>
          </>}
          {result && <div role="status" className="sync-summary"><b>Đã thêm {result.inserted} nhật ký · Bỏ qua {result.skipped} dòng trùng</b><span>Các dòng không được chọn hoặc có lỗi chưa được nhập.</span></div>}
          <button className="secondary-button" onClick={downloadReport}>Tải báo cáo đối chiếu CSV</button>
        </>}
      </div>
    </Modal>}
  </>;
}
