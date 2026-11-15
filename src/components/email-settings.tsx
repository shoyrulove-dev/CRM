"use client";
import { useState } from "react";
import { Mail, Send } from "lucide-react";

export function EmailSettings({ configured, from, testTo }: { configured: boolean; from: string; testTo: string }) {
  const [form, setForm] = useState({ apiKey: "", from, testTo });
  const [ready, setReady] = useState(configured), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function submit(action: "save" | "test") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/email-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, action }) });
      const data = await response.json();
      setMessage(data.error || data.message);
      if (response.ok && action === "save") { setReady(true); setForm((value) => ({ ...value, apiKey: "" })); }
    } catch { setMessage("Chưa kết nối được. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <section className="panel email-config">
    <div className="panel-head"><div><h2><Mail size={20} /> Email khôi phục mật khẩu</h2><p>{ready ? "Đã có cấu hình gửi email." : "Thiết lập Resend để nhân viên tự lấy lại mật khẩu."}</p></div><span className={`account-state ${ready ? "on" : "off"}`}>{ready ? "Đã cấu hình" : "Chưa cấu hình"}</span></div>
    <div className="entity-form"><div className="form-grid">
      <label className="full">Resend API key<input type="password" autoComplete="new-password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={ready ? "Để trống để giữ key hiện tại" : "re_..."} /></label>
      <label>Email gửi<input type="email" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
      <label>Email nhận thử<input type="email" value={form.testTo} onChange={(e) => setForm({ ...form, testTo: e.target.value })} /></label>
    </div><p className="field-help">Dùng địa chỉ gửi đã xác minh trong Resend. Lưu cấu hình trước khi gửi thử. Email khôi phục được gửi đến email của từng tài khoản.</p>
    <p role="status">{message}</p><footer><button type="button" className="secondary-button" disabled={busy || !ready} onClick={() => submit("test")}><Send size={16} /> Gửi thử</button><button type="button" className="primary-button" disabled={busy} onClick={() => submit("save")}>{busy ? "Đang xử lý..." : "Lưu cấu hình email"}</button></footer></div>
  </section>;
}
