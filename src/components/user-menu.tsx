"use client";

import { FormEvent, useState } from "react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { Modal } from "./modal";

export function UserMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const initials = name.split(" ").slice(-2).map((part) => part[0]).join("") || "N";

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (values.newPassword !== values.confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) return setError(result.error || "Không thể đổi mật khẩu.");
    event.currentTarget.reset();
    setSuccess("Đã đổi mật khẩu. Các phiên đăng nhập cũ đã được thu hồi.");
  }

  return (
    <div className="user-menu-wrap">
      <button className="user-chip" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="avatar small">{initials}</div>
        <span>{name}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="user-menu">
          <button onClick={() => { setOpen(false); setChanging(true); }}>
            <KeyRound size={16} /> Đổi mật khẩu
          </button>
          <form action="/api/auth/logout" method="post">
            <button><LogOut size={16} /> Đăng xuất</button>
          </form>
        </div>
      )}
      {changing && (
        <Modal
          title="Đổi mật khẩu"
          description="Mật khẩu mới cần ít nhất 8 ký tự."
          onClose={() => { setChanging(false); setError(""); setSuccess(""); }}
        >
          <form className="entity-form" onSubmit={changePassword}>
            <div className="form-grid">
              <label className="full">Mật khẩu hiện tại<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
              <label className="full">Mật khẩu mới<input name="newPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
              <label className="full">Nhập lại mật khẩu mới<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
            </div>
            {error && <p className="form-error">{error}</p>}
            {success && <p className="form-success">{success}</p>}
            <footer>
              <button type="button" className="secondary-button" onClick={() => setChanging(false)}>Đóng</button>
              <button className="primary-button" disabled={saving}>{saving ? "Đang lưu..." : "Đổi mật khẩu"}</button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
}
