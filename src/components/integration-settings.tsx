"use client";
import { FormEvent, useRef, useState } from "react";
import { Cloud, Database, ShoppingBag } from "lucide-react";
type LoyaltyStatus = {
  total: number; missing: number; due: number; status: string;
  updated: number; failed: number; halted: boolean; finishedAt: string; error: string;
};
type Data = {
  webhookUrl: string;
  haravanShop: string;
  r2Endpoint: string;
  r2Bucket: string;
  r2AccessKeyId: string;
  hasHaravanToken: boolean;
  hasWebhookSecret: boolean;
  hasR2Secret: boolean;
  status: { haravan: boolean; r2: boolean };
  loyalty: LoyaltyStatus | null;
  sync: {
    status: string;
    lastSuccessAt: string;
    customers: number;
    orders: number;
    error: string;
    complete: boolean;
  } | null;
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
    [haravanTest, setHaravanTest] = useState<HaravanTest | null>(null),
    [syncing, setSyncing] = useState(false),
    [testingR2, setTestingR2] = useState(false),
    [sync, setSync] = useState(initial.sync),
    [loyalty, setLoyalty] = useState(initial.loyalty),
    [syncingLoyalty, setSyncingLoyalty] = useState(false);
  const stopLoyalty = useRef(false);
  async function syncLoyalty() {
    stopLoyalty.current = false;
    setSyncingLoyalty(true);
    setMessage("Đang đồng bộ hạng và điểm qua API V2. Giữ trang mở để lấy các lô tiếp theo.");
    try {
      do {
        const response = await fetch("/api/settings", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "syncHaravanLoyalty" }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Không thể đồng bộ Loyalty V2.");
        const result = json.data as LoyaltyStatus & { busy: boolean };
        setLoyalty(result);
        setMessage(result.busy ? "Một lượt đồng bộ V2 khác đang chạy. Vui lòng kiểm tra lại sau."
          : `Lô V2: cập nhật ${result.updated} khách, ${result.failed} lỗi. Còn ${result.due} khách đến lượt; ${result.missing} khách chưa có dữ liệu Loyalty.`);
        if (result.busy || result.halted || result.due === 0) break;
      } while (!stopLoyalty.current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đồng bộ Loyalty V2.");
    } finally {
      setSyncingLoyalty(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("Đang lưu...");
    try {
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
    } catch { setMessage("Kết nối bị gián đoạn. Cấu hình trên máy chủ chưa được xác nhận; vui lòng thử lại."); }
  }
  async function testHaravan() {
    setTesting(true);
    setMessage("Đang kiểm tra Token với Haravan...");
    setHaravanTest(null);
    try {
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
        ? "Đã đọc được cửa hàng, đơn hàng, khách hàng và sản phẩm. Hạng thành viên và điểm thưởng cần kiểm tra riêng."
        : "Token đã được kiểm tra. Vui lòng xem quyền nào còn thiếu bên dưới.",
    );
    } catch { setMessage("Không thể kết nối máy chủ để kiểm tra Haravan. Vui lòng thử lại."); }
    finally { setTesting(false); }
  }
  async function syncHaravan() {
    setSyncing(true);
    setMessage("Đang lấy dữ liệu mới từ Haravan. Vui lòng giữ trang này mở...");
    try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "syncHaravan" }),
    });
    const json = await response.json();
    setSyncing(false);
    if (!response.ok)
      return setMessage(json.error || "Không thể đồng bộ dữ liệu Haravan.");
    setSync({
      status: "success",
      lastSuccessAt: json.data.finishedAt,
      customers: json.data.customers,
      orders: json.data.orders,
      error: "",
      complete: json.data.complete,
    });
    setMessage(
      json.data.complete
        ? `Đồng bộ hoàn tất ${json.data.totalCustomers} khách hàng và ${json.data.totalOrders} đơn hàng.`
        : `Đã nhập thêm ${json.data.customers} khách hàng và ${json.data.orders} đơn hàng. Chọn Đồng bộ dữ liệu ngay lần nữa để lấy đợt tiếp theo.`,
    );
    } catch { setMessage("Kết nối bị gián đoạn. Kiểm tra lại trạng thái đồng bộ trước khi thử lại."); }
    finally { setSyncing(false); }
  }
  async function testR2() {
    setTestingR2(true);
    setMessage("Đang kiểm tra quyền đọc, ghi và xóa trên Cloudflare R2...");
    try {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "testR2" }),
    });
    const json = await response.json();
    setTestingR2(false);
    setMessage(
      response.ok
        ? `R2 hoạt động tốt. Đã kiểm tra bucket ${json.data.bucket}.`
        : json.error || "Không thể kết nối Cloudflare R2.",
    );
    } catch { setMessage("Không thể kết nối máy chủ để kiểm tra R2. Vui lòng thử lại."); }
    finally { setTestingR2(false); }
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
              <summary>Nhận thông báo thay đổi từ Haravan (tùy chọn)</summary>
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
                  value={initial.webhookUrl}
                  readOnly
                />
                <small>
                  Webhook lưu thông báo thay đổi; dữ liệu khách hàng và đơn hàng
                  hiện được cập nhật qua lịch đồng bộ.
                </small>
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
              <button
                type="button"
                className="secondary-button"
                disabled={syncing || syncingLoyalty || !status.haravan}
                onClick={syncHaravan}
              >
                {syncing ? "Đang đồng bộ..." : "Đồng bộ dữ liệu ngay"}
              </button>
              <button type="button" className="secondary-button"
                disabled={syncing || syncingLoyalty || !status.haravan} onClick={syncLoyalty}>
                {syncingLoyalty ? "Đang đồng bộ V2..." : "Đồng bộ hạng/điểm V2"}
              </button>
              {syncingLoyalty && <button type="button" className="secondary-button"
                onClick={() => { stopLoyalty.current = true; setMessage("Sẽ dừng sau lô V2 đang chạy."); }}>
                Dừng sau lô này
              </button>}
            </footer>
          </form>
          {loyalty && <div className="sync-summary">
            <b>Loyalty Haravan V2</b>
            <span>{loyalty.total - loyalty.missing}/{loyalty.total} khách đã có dữ liệu · {loyalty.due} khách đến lượt cập nhật</span>
            {loyalty.finishedAt && <span>Lô gần nhất: {new Date(loyalty.finishedAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })} · {loyalty.updated} cập nhật · {loyalty.failed} lỗi</span>}
            {loyalty.error && <span className="danger-text">{loyalty.error} Dữ liệu Loyalty cũ được giữ nguyên.</span>}
          </div>}
          {sync && (
            <div className="sync-summary">
              <b>
                {sync.status === "success" && sync.complete
                  ? "Đồng bộ gần nhất đã hoàn tất"
                  : sync.status === "success"
                    ? "Đã nhập một phần dữ liệu, cần đồng bộ tiếp"
                  : sync.status === "running"
                    ? "Đang đồng bộ dữ liệu"
                    : "Lần đồng bộ gần nhất chưa thành công"}
              </b>
              {sync.lastSuccessAt && (
                <span>
                  {new Date(sync.lastSuccessAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })} · {sync.customers} khách hàng · {sync.orders} đơn hàng
                </span>
              )}
              {sync.error && <span className="danger-text">{sync.error}</span>}
            </div>
          )}
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
              <p className="muted">Hạng thành viên, điểm thưởng và ngày hết hạn điểm được đọc riêng qua API chi tiết khách hàng V2 bằng token đã lưu. Chọn Đồng bộ hạng/điểm V2 để cập nhật; không tự suy ra hạng hoặc điểm từ doanh thu.</p>
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
              <button
                type="button"
                className="secondary-button"
                disabled={testingR2 || !status.r2}
                onClick={testR2}
              >
                {testingR2 ? "Đang kiểm tra..." : "Kiểm tra R2"}
              </button>
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
