"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound, ArrowLeft } from "lucide-react";
import { NichieiBrand } from "@/components/nichiei-brand";

export default function ResetPasswordPage() {
  const [token, setToken] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [done, setDone] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const value = window.location.hash.slice(1);
    // Capture the browser-only fragment after hydration; never serialize it in HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (value) { setToken(value); window.history.replaceState(null, "", window.location.pathname); }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    setError(""); setMessage("");
    if (token && values.password !== values.confirm) return setError("Mật khẩu xác nhận chưa khớp.");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(token ? { token, password: values.password } : { email: values.email }) });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Chưa thể xử lý yêu cầu.");
      else { setMessage(data.message); setDone(true); }
    } catch { setError("Mất kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><NichieiBrand /><div className="auth-symbol"><KeyRound /></div><p className="eyebrow">BẢO MẬT TÀI KHOẢN</p><h1>{token ? "Đặt mật khẩu mới" : "Quên mật khẩu?"}</h1><p>{token ? "Tạo mật khẩu riêng để tiếp tục sử dụng CRM." : "Nhập email tài khoản. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu có hiệu lực trong 30 phút."}</p>
    {!done && <form className="entity-form" onSubmit={submit}><div className="form-grid">{token ? <><label className="full">Mật khẩu mới<input type="password" name="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label><label className="full">Nhập lại mật khẩu mới<input type="password" name="confirm" minLength={8} maxLength={128} autoComplete="new-password" required /></label></> : <label className="full">Email tài khoản<input type="email" name="email" autoComplete="email" maxLength={254} required /></label>}</div>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Đang xử lý..." : token ? "Lưu mật khẩu mới" : "Gửi liên kết khôi phục"}</button></form>}
    {message && <p role="status" className="form-success">{message}</p>}<Link className="auth-back" href="/login"><ArrowLeft size={16} /> Trở về đăng nhập</Link>
  </section></main>;
}
