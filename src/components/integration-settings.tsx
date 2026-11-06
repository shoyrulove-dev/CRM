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
export function IntegrationSettings({
  initial,
  dataReady,
}: {
  initial: Data;
  dataReady: boolean;
}) {
  const [tab, setTab] = useState<"general" | "haravan" | "r2">("general"),
    [status, setStatus] = useState(initial.status),
    [message, setMessage] = useState("");
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
                Nhập thông tin ứng dụng Haravan. Khóa bí mật được mã hóa trước
                khi lưu.
              </p>
            </div>
          </div>
          <form onSubmit={save} className="config-form">
            <label>
              Tên cửa hàng
              <input
                name="haravanShop"
                defaultValue={initial.haravanShop}
                placeholder="nichiei.myharavan.com"
                required
              />
            </label>
            <label>
              Khóa truy cập
              <input
                name="haravanAccessToken"
                type="password"
                placeholder={
                  initial.hasHaravanToken
                    ? "Đã lưu · nhập để thay đổi"
                    : "Nhập khóa truy cập"
                }
              />
            </label>
            <label>
              Khóa xác thực webhook
              <input
                name="haravanWebhookSecret"
                type="password"
                placeholder={
                  initial.hasWebhookSecret
                    ? "Đã lưu · nhập để thay đổi"
                    : "Nhập khóa xác thực"
                }
              />
            </label>
            <label className="full">
              Địa chỉ nhận dữ liệu
              <input
                value="https://nichiei-crm.vercel.app/api/webhooks/haravan"
                readOnly
              />
            </label>
            <footer>
              <button className="primary-button">Lưu cấu hình Haravan</button>
            </footer>
          </form>
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
