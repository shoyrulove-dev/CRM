"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import {
  haravanCustomerFields, type HaravanCustomerField, type HaravanCustomerCorrections, type HaravanCustomerSource,
} from "@/lib/haravan-customer-reconciliation";

export function HaravanCustomerReconciliation({ id, source, corrections, current }: {
  id: string;
  source?: HaravanCustomerSource;
  corrections?: HaravanCustomerCorrections;
  current: HaravanCustomerSource;
}) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<HaravanCustomerField>("name");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const correction = corrections?.[field];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !source) return;
    const data = new FormData(event.currentTarget);
    const reset = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "reset";
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/customers/${encodeURIComponent(id)}/haravan-reconciliation`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, action: reset ? "reset" : "save", value: data.get("value"), reason: data.get("reason"),
          expectedSource: source[field], expectedEditedAt: correction?.editedAt || "" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) { setError(result?.error || "Không thể lưu thay đổi. Thử lại sau."); return; }
      setMessage(reset ? "Đã trả về giá trị Haravan." : "Đã lưu giá trị dùng trong CRM.");
      router.refresh();
    } catch {
      setError("Chưa xác nhận được kết quả. Tải lại trang để kiểm tra trước khi thử lại.");
    } finally { setBusy(false); }
  }

  return <>
    <button type="button" className="secondary-button" onClick={() => { setOpen(true); setError(""); setMessage(""); }}>Đối soát Haravan</button>
    {open && <Modal title="Đối soát hồ sơ Haravan" description="So sánh dữ liệu đồng bộ và giá trị đang dùng trong CRM." onClose={() => { if (!busy) setOpen(false); }}>
      {!source ? <p className="entity-form">Hồ sơ chưa có bản nguồn để so sánh. Bản nguồn sẽ được ghi khi hồ sơ đồng bộ lại từ Haravan.</p> : <div className="entity-form">
        <div className="table-wrap"><table>
          <thead><tr><th>Thông tin</th><th>Gốc Haravan</th><th>Đang dùng trong CRM</th></tr></thead>
          <tbody>{(Object.keys(haravanCustomerFields) as HaravanCustomerField[]).map(key => {
            const item = corrections?.[key];
            return <tr key={key}><th scope="row">{haravanCustomerFields[key]}</th><td>{source[key] || "—"}</td>
              <td>{current[key] || "—"}{item && <small style={{ display: "block" }}>
                {item.sourceAtEdit !== source[key] ? "Nguồn đã đổi · Cần rà lại" : "Đã chỉnh trong CRM"}<br />
                {item.editor} · {new Date(item.editedAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}<br />{item.reason}
              </small>}</td></tr>;
          })}</tbody>
        </table></div>
        <form className="entity-form" key={`${field}:${correction?.editedAt || ""}:${source[field]}`} onSubmit={submit}>
          <label>Thông tin cần chỉnh<select value={field} disabled={busy} onChange={event => { setField(event.target.value as HaravanCustomerField); setError(""); setMessage(""); }}>
            {Object.entries(haravanCustomerFields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Giá trị dùng trong CRM<input name="value" type={field === "birthDate" ? "date" : field === "phone" ? "tel" : "text"}
            defaultValue={current[field]} maxLength={120} disabled={busy} /></label>
          {field === "phone" && <p>SĐT liên hệ dùng để gọi khách. Việc ghép dữ liệu Haravan và Excel vẫn dùng SĐT nguồn.</p>}
          <label>Lý do<textarea name="reason" minLength={3} maxLength={500} rows={2} required disabled={busy} /></label>
          <footer>
            {correction && <button className="secondary-button" value="reset" disabled={busy}>Trả về Haravan</button>}
            <button className="primary-button" value="save" disabled={busy}>{busy ? "Đang lưu…" : "Lưu điều chỉnh"}</button>
          </footer>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p role="status">{message}</p>}
      </div>}
    </Modal>}
  </>;
}
