"use client";

import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@nichiei.vn");
  const [password, setPassword] = useState("Nichiei@2026");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Không thể đăng nhập.");
      setLoading(false);
      return;
    }
    const nextPath =
      new URLSearchParams(window.location.search).get("next") || "/";
    router.replace(nextPath);
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <div className="login-brand-inner">
          <div className="brand-lockup">
            <span>N</span>
            <div>
              <strong>NICHIEI</strong>
              <small>Customer Care</small>
            </div>
          </div>
          <h1>
            Chăm sóc đúng lúc.
            <br />
            Gắn kết dài lâu.
          </h1>
          <p>
            Một nơi duy nhất để đội ngũ theo dõi khách hàng, lịch sử mua hàng và
            từng mốc chăm sóc quan trọng.
          </p>
          <div className="login-quote">
            <i>“</i>
            <p>
              CRM giúp chúng tôi không bỏ lỡ bất kỳ khách hàng nào cần được quan
              tâm.
            </p>
            <span>Đội ngũ Chăm sóc khách hàng Nichiei</span>
          </div>
        </div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="mobile-logo">NICHIEI</div>
          <p className="eyebrow">CHÀO MỪNG TRỞ LẠI</p>
          <h2>Đăng nhập hệ thống</h2>
          <p className="form-note">Sử dụng tài khoản được cấp để tiếp tục.</p>
          <label>
            Email
            <div>
              <Mail size={17} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </label>
          <label>
            Mật khẩu
            <div>
              <LockKeyhole size={17} />
              <input
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label="Hiện mật khẩu"
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button className="login-submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            <ArrowRight size={17} />
          </button>
          <div className="demo-hint">
            <strong>Tài khoản demo</strong>
            <span>admin@nichiei.vn / Nichiei@2026</span>
          </div>
        </form>
      </section>
    </main>
  );
}
