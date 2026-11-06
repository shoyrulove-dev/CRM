import { Cloud, Database, ShoppingBag } from "lucide-react";
import { hasDatabase } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export default function SettingsPage() {
  const dataReady=hasDatabase(),salesReady=Boolean(process.env.HARAVAN_ACCESS_TOKEN&&process.env.HARAVAN_WEBHOOK_SECRET),backupReady=Boolean(process.env.R2_ENDPOINT&&process.env.R2_BUCKET&&process.env.R2_ACCESS_KEY_ID&&process.env.R2_SECRET_ACCESS_KEY);
  return <><div className="page-heading compact"><div><p className="eyebrow">HỆ THỐNG</p><h1>Trạng thái hệ thống</h1><p>Theo dõi nơi lưu dữ liệu, kết nối bán hàng và sao lưu an toàn.</p></div></div><div className="settings-grid">
    <section className="panel setting-card"><span className="integration-logo mongo"><Database/></span><div><h2>Kho dữ liệu</h2><p>Lưu thông tin khách hàng, đơn hàng và lịch sử chăm sóc.</p><span className={`connection ${dataReady?"ready":"pending"}`}>{dataReady?"Đang hoạt động":"Chưa sẵn sàng"}</span></div></section>
    <section className="panel setting-card"><span className="integration-logo hara"><ShoppingBag/></span><div><h2>Kết nối bán hàng</h2><p>Tự động nhận khách hàng và đơn hàng từ Haravan.</p><span className={`connection ${salesReady?"ready":"pending"}`}>{salesReady?"Đã bật":"Sẽ thiết lập sau bản dùng thử"}</span></div></section>
    <section className="panel setting-card"><span className="integration-logo r2"><Cloud/></span><div><h2>Sao lưu an toàn</h2><p>Lưu bản sao dữ liệu hằng ngày trên Cloudflare R2 khi chuyển sang máy chủ chính thức.</p><span className={`connection ${backupReady?"ready":"pending"}`}>{backupReady?"Đã bật":"Chờ thiết lập khi chuyển máy chủ"}</span></div></section>
  </div></>;
}
