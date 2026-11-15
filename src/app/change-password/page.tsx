"use client";
import { FormEvent, useState } from "react";
import { NichieiBrand } from "@/components/nichiei-brand";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.newPassword !== values.confirm) return setError("Mật khẩu xác nhận chưa khớp.");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Chưa thể đổi mật khẩu.");
      else { router.replace("/"); router.refresh(); }
    } catch { setError("Mất kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card"><NichieiBrand /><p className="eyebrow">CHÀO MỪNG BẠN</p><h1>Đổi mật khẩu tạm thời</h1><p>Đặt mật khẩu riêng trước khi bắt đầu sử dụng CRM để bảo vệ tài khoản của bạn.</p><form className="entity-form" onSubmit={submit}><div className="form-grid"><label className="full">Mật khẩu tạm thời<input type="password" name="currentPassword" autoComplete="current-password" required /></label><label className="full">Mật khẩu mới<input type="password" name="newPassword" minLength={8} maxLength={128} autoComplete="new-password" required /></label><label className="full">Nhập lại mật khẩu mới<input type="password" name="confirm" minLength={8} maxLength={128} autoComplete="new-password" required /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? "Đang lưu..." : "Lưu mật khẩu và tiếp tục"}</button></form><form action="/api/auth/logout" method="post"><button className="text-button">Đăng xuất</button></form></section></main>;
}
