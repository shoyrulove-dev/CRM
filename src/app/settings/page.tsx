import { hasDatabase } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const mongoReady = hasDatabase();
  const haravanReady = Boolean(process.env.HARAVAN_ACCESS_TOKEN && process.env.HARAVAN_WEBHOOK_SECRET);
  return <>
    <div className="page-heading compact"><div><p className="eyebrow">HỆ THỐNG</p><h1>Cài đặt</h1><p>Trạng thái kết nối dữ liệu và cấu hình nghiệp vụ.</p></div></div>
    <div className="settings-grid">
      <section className="panel setting-card"><span className="integration-logo hara">H</span><div><h2>Haravan</h2><p>Đồng bộ khách hàng, sản phẩm và đơn hàng.</p><span className={`connection ${haravanReady ? "ready" : "pending"}`}>{haravanReady ? "Đã cấu hình thông tin kết nối" : "Chờ ACCESS_TOKEN và WEBHOOK_SECRET"}</span></div></section>
      <section className="panel setting-card"><span className="integration-logo mongo">M</span><div><h2>MongoDB Atlas</h2><p>Cơ sở dữ liệu chính của hệ thống CRM.</p><span className={`connection ${mongoReady ? "ready" : "pending"}`}>{mongoReady ? "Đã kết nối" : "Chưa cấu hình MONGODB_URI"}</span></div></section>
    </div>
  </>;
}
