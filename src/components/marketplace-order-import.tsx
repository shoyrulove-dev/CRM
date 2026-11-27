"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/demo-data";

type Row = { id?: string; code: string; channel?: string; owner?: string; date?: string;
  net?: number; issue: string; revision?: string; marketplace?: boolean };
type Selection = { owner: string; channel: string; checked: boolean };
const channels = ["Shopee", "Google Shop", "TikTok Shop", "Lazada"];
const channelKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^tiktok$/, "tiktokshop");

export function MarketplaceOrderImport() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [selection, setSelection] = useState<Record<string, Selection>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const url = "/api/reports/marketplace-import";
  const selected = rows.filter(row => row.id && !row.issue && selection[row.code]?.checked);
  const ready = selected.length > 0 && selected.every(row => selection[row.code].owner && selection[row.code].channel);

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRows([]); setMessage(""); setBusy(true);
    try {
      const response = await fetch(url, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEmployees(data.employees);
      setSelection(Object.fromEntries((data.rows as Row[]).map(row => [row.code, {
        owner: data.employees.includes(row.owner) ? row.owner! : "",
        channel: channels.find(channel => channelKey(channel) === channelKey(row.channel || "")) || "",
        checked: Boolean(row.marketplace && !row.issue),
      }])));
      setRows(data.rows);
      setMessage(`Đã đối chiếu ${data.rows.length} mã đơn.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xem trước được tệp.");
    } finally { setBusy(false); }
  }

  async function approve() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries: selected.map(row => ({ id: row.id, revision: row.revision, ...selection[row.code] })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const outcomes = new Map<string, string>((data.results as { id: string; error: string }[]).map(row => [row.id, row.error]));
      const saved = [...outcomes.values()].filter(error => !error).length;
      setRows(current => current.map(row => row.id && outcomes.has(row.id)
        ? { ...row, issue: outcomes.get(row.id) || "Đã duyệt" } : row));
      setMessage(`Đã duyệt ${saved}/${selected.length} đơn.`);
      if (saved) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không duyệt được. Hãy xem trước lại để kiểm tra các đơn đã lưu.");
    } finally { setBusy(false); }
  }

  function change(code: string, value: Partial<Selection>) {
    setSelection(current => ({ ...current, [code]: { ...current[code], ...value } }));
  }

  return <details className="panel list-panel">
    <summary className="panel-head">Nhập đơn sàn từ Excel</summary>
    <form className="entity-form" onSubmit={preview}>
      <p>Tải tệp .xlsx có cột Mã đơn hàng. CRM đối chiếu và lấy kênh từ đơn đã đồng bộ. Bạn có thể chỉnh kênh và người phụ trách trước khi duyệt.</p>
      <label>Tệp đơn hàng<input type="file" name="file" accept=".xlsx" required disabled={busy} /></label>
      <div><button className="secondary-button" disabled={busy}>Xem trước</button></div>
      <p role="status">{busy ? "Đang xử lý…" : message}</p>
    </form>
    {rows.length > 0 && <>
      <div className="table-wrap"><table>
        <thead><tr><th>Chọn</th><th>Mã đơn</th><th>Ngày tính</th><th>Kênh</th><th>Phụ trách chính</th><th>Sau trừ ship</th><th>Kết quả</th></tr></thead>
        <tbody>{rows.map(row => {
          const item = selection[row.code];
          const editable = Boolean(row.id && !row.issue);
          return <tr key={row.code}>
            <td>{editable && <input aria-label={`Chọn đơn ${row.code}`} type="checkbox" checked={item.checked} disabled={busy || !item.channel}
              onChange={event => change(row.code, { checked: event.target.checked })} />}</td>
            <td>{row.code}</td><td>{row.date || "—"}</td>
            <td>{editable ? <select aria-label={`Kênh đơn ${row.code}`} value={item.channel} disabled={busy}
              onChange={event => change(row.code, { channel: event.target.value, checked: Boolean(event.target.value) })}>
              <option value="">{row.channel || "Chọn kênh sàn"}</option>{channels.map(channel => <option key={channel}>{channel}</option>)}
            </select> : row.channel || "—"}</td>
            <td>{editable ? <select aria-label={`Phụ trách đơn ${row.code}`} value={item.owner} disabled={busy}
              onChange={event => change(row.code, { owner: event.target.value })}>
              <option value="">Chọn nhân viên</option>{employees.map(name => <option key={name}>{name}</option>)}
            </select> : row.owner || "—"}</td>
            <td>{row.net != null && !row.issue.includes("phí vận chuyển") ? money.format(row.net) : "—"}</td>
            <td>{row.issue || (item.channel ? "Chờ duyệt" : "Chưa chọn kênh sàn")}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <div className="panel-head"><button type="button" className="primary-button" disabled={busy || !ready} onClick={approve}>
        Duyệt {selected.length} đơn đã chọn
      </button></div>
    </>}
  </details>;
}
