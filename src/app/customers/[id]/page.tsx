import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, CircleDollarSign, FileText, MapPin, MessageSquareText, Package, Phone, ShoppingBag, UserRound } from "lucide-react";
import { getCustomerProfile } from "@/lib/data-store";
import { money } from "@/lib/demo-data";
import { CreateActivityButton } from "@/components/create-activity-button";
import { CreateTicketButton } from "@/components/create-ticket-button";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { customer, activities, orders, tickets } = await getCustomerProfile(id);
  if (!customer) notFound();
  return <>
    <div className="profile-back"><Link href="/customers"><ArrowLeft size={16}/>Quay lại danh sách khách hàng</Link></div>
    <div className="profile-heading"><div className="profile-identity"><span>{customer.name.split(" ").slice(-2).map(x=>x[0]).join("")}</span><div><div className="profile-title"><h1>{customer.name}</h1><i>{customer.segment}</i></div><p>{customer.id} · <Phone size={13}/>{customer.phone} · Phụ trách: <strong>{customer.owner}</strong></p></div></div><div className="profile-actions"><CreateTicketButton customers={[customer]}/><CreateActivityButton customerId={customer.id} orders={orders}/></div></div>
    <section className="profile-stats"><article><ShoppingBag/><div><span>Đơn hàng</span><strong>{customer.orders}</strong></div></article><article><CircleDollarSign/><div><span>Doanh thu tích lũy</span><strong>{money.format(customer.revenue)}</strong></div></article><article><Package/><div><span>Đơn gần nhất</span><strong>{customer.lastOrder}</strong></div></article><article><CalendarPlus/><div><span>Chăm sóc tiếp theo</span><strong>{customer.nextCare}</strong></div></article></section>
    <div className="profile-grid"><div className="profile-main">
      <section className="panel profile-panel"><div className="panel-head"><div><h2>Dòng thời gian chăm sóc</h2><p>Toàn bộ tương tác với khách hàng</p></div></div><div className="timeline">{activities.length ? activities.map(a=><article key={a.id}><div className="timeline-marker"><MessageSquareText size={15}/></div><div className="timeline-card"><header><div><strong>Lần {a.careAttempt || "—"} · {a.purpose}</strong><span>{new Date(a.occurredAt).toLocaleString("vi-VN",{timeZone:"Asia/Bangkok"})}{a.orderId&&` · Đơn ${a.orderId}`}</span></div><i>{a.channel}</i></header><p><b>Kết quả:</b> {a.result} · <b>Liên lạc:</b> {a.contactStatus}{a.purchaseChannel&&<> · <b>Kênh mua:</b> {a.purchaseChannel}</>}</p>{a.productEndDate&&<p><b>Hết liệu trình:</b> {a.productEndDate} · Lệch {a.dueOffsetDays} ngày {a.repurchaseTimely!==undefined&&`· ${a.repurchaseTimely?"Đúng thời điểm":"Sai thời điểm"}`}</p>}{a.note&&<blockquote>{a.note}</blockquote>}<footer><span>Nhân viên: {a.employee}</span>{a.satisfaction&&<span>Hài lòng: {"★".repeat(a.satisfaction)}{"☆".repeat(5-a.satisfaction)}</span>}{a.adverseReaction&&<span className="danger-text">Có phản ứng bất thường</span>}</footer></div></article>) : <p className="no-data">Chưa có lịch sử chăm sóc.</p>}</div></section>
      <section className="panel profile-panel"><div className="panel-head"><div><h2>Lịch sử đơn hàng</h2><p>Các lần mua hàng của khách</p></div></div><div className="order-list">{orders.map(o=><article key={o.id}><div className="order-head"><div><strong>{o.code}</strong><span>{o.orderDate} · {o.channel} · {o.location}</span></div><div><span className="segment">{o.purchaseType}</span><strong>{money.format(o.total)}</strong></div></div><div className="order-products">{o.products.map(p=><div key={`${o.id}-${p.sku}`}><span><b>{p.name}</b><small>Mã sản phẩm: {p.sku}</small></span><span>{p.quantity} × {money.format(p.unitPrice)}</span></div>)}</div>{o.promotion&&<p><b>Khuyến mãi:</b> {o.promotion}{o.gift&&` · Quà tặng: ${o.gift}`}</p>}</article>)}</div></section>
    </div><aside className="profile-side">
      <section className="panel info-card"><div className="panel-head"><h2>Thông tin khách hàng</h2></div><dl><div><dt><UserRound/>Phân nhóm</dt><dd>{customer.segment}</dd></div><div><dt><MapPin/>Mục tiêu sức khỏe</dt><dd>{customer.healthGoal}</dd></div><div><dt><Phone/>Điện thoại</dt><dd>{customer.phone}</dd></div><div><dt><CalendarPlus/>Lịch tiếp theo</dt><dd>{customer.nextCare}</dd></div></dl></section>
      <section className="panel ticket-card"><div className="panel-head"><div><h2>Phiếu yêu cầu</h2><p>{tickets.length} phiếu liên quan</p></div></div>{tickets.map(t=><article key={t.id}><div><strong>{t.id}</strong><span className={`priority ${t.priority==="Khẩn cấp"?"urgent":""}`}>{t.priority}</span></div><p>{t.title}</p><footer>{t.status} · {t.owner}</footer></article>)}{!tickets.length&&<p className="no-data">Chưa có phiếu yêu cầu.</p>}</section>
      <section className="panel quick-note"><FileText/><div><strong>Ghi chú khách hàng</strong><p>Mọi ghi chú chăm sóc được lưu theo thời gian để đội ngũ dễ theo dõi và bàn giao.</p></div></section>
    </aside></div>
  </>;
}
