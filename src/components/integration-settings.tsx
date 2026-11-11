"use client";
import { FormEvent, useState } from "react";
import { Cloud, Database, ShoppingBag } from "lucide-react";
type Data = {
  haravanShop: string;
  r2Endpoint: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  hasHaravanToken: boolean;
  hasWebhookSecret: boolean;
  hasR2Secret: boolean;
  status: { haravan: boolean; r2: boolean };
};
type HaravanTest = {
  ok: boolean;
  shopName: string;
  shopDomain: string;
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    status: number;
    message: string;
  }>;
};
export function IntegrationSettings({
  initial,
  dataReady,
}: {
  initial: Data;
  dataReady: boolean;
}) {
  const [tab, setTab] = useState<"general" | "haravan" | "r2">("general"),
    [status, setStatus] = useState(initial.status),
    [message, setMessage] = useState(""),
    [testing, setTesting] = useState(false),
    [haravanTest, setHaravanTest] = useState<HaravanTest | null>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Đang lưu...");
    const body = Object.fromEntries(new FormData(e.currentTarget).entries()),
      r = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      j = await r.json();
    if (!r.ok) return setMessage(j.error || "Không thể lưu cài đặt");
    setStatus(j.status);
    setMessage("Đã lưu an toàn. Cấu hình mới được áp dụng ngay.");
  }
  async function testHaravan() {
    setTesting(true);
    setMessage("Đang kiểm tra Token với Haravan...");
    setHaravanTest(null);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "testHaravan" }),
    });
    const json = await response.json();
    setTesting(false);
    if (!response.ok)
      return setMessage(json.error || "Không thể kiểm tra kết nối Haravan.");
    setHaravanTest(json.data);
    setMessage(
      json.data.ok
        ? "Token hoạt động tốt và có đủ quyền đọc dữ liệu cần thiết."
        : "Token đã được kiểm tra. Vui lòng xem quyền nào còn thiếu bên dưới.",
    );
  }
  return (
    <>
      <div className="settings-tabs">
        <button
          className={tab === "general" ? "active" : ""}
          onClick={() => setTab("general")}
        >
          Tổng quan
        </button>
        <button
          className={tab === "haravan" ? "active" : ""}
          onClick={() => setTab("haravan")}
        >
          Haravan <i className={status.haravan ? "ok" : "wait"} />
        </button>
        <button
          className={tab === "r2" ? "active" : ""}
          onClick={() => setTab("r2")}
        >
          Cloudflare R2 <i className={status.r2 ? "ok" : "wait"} />
        </button>
      </div>
      {tab === "general" && (
        <div className="system-status-grid">
          <Status
            icon={Database}
            title="Cơ sở dữ liệu"
            ready={dataReady}
            text="Khách hàng, lịch chăm sóc, tài khoản và cấu hình."
          />
          <Status
            icon={ShoppingBag}
            title="Haravan"
            ready={status.haravan}
            text="Nhận khách hàng và đơn hàng từ hệ thống bán hàng."
          />
          <Status
            icon={Cloud}
            title="Cloudflare R2"
            ready={status.r2}
            text="Lưu bản sao dữ liệu khi chạy lịch sao lưu."
          />
        </div>
      )}
      {tab === "haravan" && (
        <section className="panel config-panel">
          <div className="config-copy">
            <ShoppingBag />
            <div>
              <h2>Kết nối Haravan</h2>
              <p>
                Private App chỉ cần một Token. Token được mã hóa trước khi lưu
                và không hiển thị lại.
              </p>
            </div>
          </div>
          <form onSubmit={save} className="config-form">
            <label className="full">
              Token Private App
              <input
                name="haravanAccessToken"
                type="password"
                placeholder={
                  initial.hasHaravanToken
                    ? "Đã lưu · nhập để thay đổi"
                    : "Dán Token được cấp trong Private App"
                }
              />
              <small>
                Token cần quyền đọc đơn hàng, khách hàng và sản phẩm.
              </small>
            </label>
            <label className="full">
              Cửa hàng nhận diện tự động
              <input
                value={
                  haravanTest?.shopDomain ||
                  initial.haravanShop ||
                  "Sẽ hiển thị sau khi kiểm tra Token"
                }
                readOnly
              />
            </label>
            <details className="full config-advanced">
              <summary>Đồng bộ tự động bằng webhook (tùy chọn)</summary>
              <label>
                Webhook authentication secret
                <input
                  name="haravanWebhookSecret"
                  type="password"
                  placeholder={
                    initial.hasWebhookSecret
                      ? "Đã lưu · nhập để thay đổi"
                      : "Có thể bổ sung sau"
                  }
                />
              </label>
              <label>
                Địa chỉ nhận dữ liệu
                <input
                  value="https://nichiei-crm.vercel.app/api/webhooks/haravan"
                  readOnly
                />
              </label>
            </details>
            <footer>
              <button className="primary-button">Lưu Token</button>
              <button
                type="button"
                className="secondary-button"
                disabled={
                  testing || (!initial.hasHaravanToken && !status.haravan)
                }
                onClick={testHaravan}
              >
                {testing ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
              </button>
            </footer>
          </form>
          {haravanTest && (
            <div className="connection-checks full">
              <h3>{haravanTest.shopName || "Kết quả kiểm tra Haravan"}</h3>
              {haravanTest.checks.map((check) => (
                <p
                  key={check.key}
                  className={check.ok ? "green-text" : "danger-text"}
                >
                  <b>
                    {check.ok ? "✓" : "!"} {check.label}
                  </b>
                  <span>{check.message}</span>
                </p>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "r2" && (
        <section className="panel config-panel">
          <div className="config-copy">
            <Cloud />
            <div>
              <h2>Sao lưu Cloudflare R2</h2>
              <p>
                Thông tin dùng cho bản sao dữ liệu hằng ngày. Khóa bí mật không
                hiển thị lại.
              </p>
            </div>
          </div>
          <form onSubmit={save} className="config-form">
            <label className="full">
              Địa chỉ R2
              <input
                name="r2Endpoint"
                defaultValue={initial.r2Endpoint}
                placeholder="https://ACCOUNT_ID.r2.cloudflarestorage.com"
                required
              />
            </label>
            <label>
              Tên kho lưu trữ
              <input
                name="r2Bucket"
                defaultValue={initial.r2Bucket}
                placeholder="nichiei-crm-backups"
                required
              />
            </label>
            <label>
              Mã truy cập
              <input
                name="r2AccessKeyId"
                placeholder={initial.r2AccessKeyId || "Nhập mã truy cập"}
              />
            </label>
            <label className="full">
              Khóa bí mật
              <input
                name="r2SecretAccessKey"
                type="password"
                placeholder={
                  initial.hasR2Secret
                    ? "Đã lưu · nhập để thay đổi"
                    : "Nhập khóa bí mật"
                }
              />
            </label>
            <footer>
              <button className="primary-button">Lưu cấu hình R2</button>
            </footer>
          </form>
        </section>
      )}
      {message && <div className="settings-message">{message}</div>}
    </>
  );
}
function Status({
  icon: Icon,
  title,
  ready,
  text,
}: {
  icon: typeof Database;
  title: string;
  ready: boolean;
  text: string;
}) {
  return (
    <section className="panel status-card">
      <span>
        <Icon />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <b className={ready ? "ready" : "pending"}>
          {ready ? "Đã sẵn sàng" : "Chưa cấu hình"}
        </b>
      </div>
    </section>
  );
}
