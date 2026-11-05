import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarCheck2, CheckCircle2, Clock3, PhoneCall, ShoppingBag, TriangleAlert, UsersRound } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { money, tasks } from "@/lib/demo-data";

const stats = [
  { label: "Khách hàng", value: "1.248", note: "+42 trong tháng", icon: UsersRound, tone: "blue", trend: "up" },
  { label: "Cần chăm sóc hôm nay", value: "12", note: "3 nhiệm vụ quá hạn", icon: CalendarCheck2, tone: "orange", trend: "warn" },
  { label: "Tỷ lệ liên lạc", value: "76,4%", note: "+4,2% so với tháng trước", icon: PhoneCall, tone: "green", trend: "up" },
  { label: "Doanh thu mua lại", value: "284,5tr", note: "+12,8% so với tháng trước", icon: ShoppingBag, tone: "violet", trend: "up" },
];

export default function Dashboard() {
  return <>
    <div className="page-heading"><div><p className="eyebrow">THỨ NĂM, 05 THÁNG 11</p><h1>Chào buổi sáng, Vân Anh</h1><p>Đây là tình hình chăm sóc khách hàng hôm nay.</p></div><button className="primary-button"><CalendarCheck2 size={18}/>Tạo lịch chăm sóc</button></div>
    <section className="stat-grid">{stats.map(s => {const Icon=s.icon; return <article className="stat-card" key={s.label}><div className={`stat-icon ${s.tone}`}><Icon size={21}/></div><div className="stat-main"><span>{s.label}</span><strong>{s.value}</strong><small className={s.trend === "warn" ? "warn-text" : "good-text"}>{s.trend === "warn" ? <TriangleAlert size={13}/> : <ArrowUpRight size={13}/>} {s.note}</small></div></article>})}</section>
    <div className="dashboard-grid">
      <section className="panel task-panel"><div className="panel-head"><div><h2>Công việc hôm nay</h2><p>Ưu tiên xử lý nhiệm vụ quá hạn trước</p></div><Link href="/care">Xem tất cả <ArrowRight size={16}/></Link></div>
        <div className="task-summary"><span><b className="red">3</b>Quá hạn</span><span><b>9</b>Đến hạn hôm nay</span><span><b className="green-text">7</b>Đã hoàn thành</span></div>
        <div className="table-wrap"><table><thead><tr><th>KHÁCH HÀNG</th><th>MỤC ĐÍCH</th><th>PHỤ TRÁCH</th><th>THỜI HẠN</th><th>TRẠNG THÁI</th><th/></tr></thead><tbody>{tasks.slice(0,3).map(t=><tr key={t.id}><td><strong>{t.customer}</strong><small>{t.phone}</small></td><td>{t.purpose}<small>{t.channel}</small></td><td><span className="person"><i>{t.owner.slice(-2).toUpperCase()}</i>{t.owner}</span></td><td className={t.status === "overdue" ? "danger-text" : ""}><Clock3 size={15}/>{t.dueAt}</td><td><StatusPill status={t.status}/></td><td><button className="row-action">•••</button></td></tr>)}</tbody></table></div>
      </section>
      <section className="panel activity-panel"><div className="panel-head"><div><h2>Hiệu quả chăm sóc</h2><p>Tháng 11/2026</p></div><button className="ghost-select">Tháng này⌄</button></div>
        <div className="ring-row"><div className="ring" style={{"--value":"76"} as React.CSSProperties}><div><strong>76%</strong><span>Liên lạc được</span></div></div><div className="metric-list"><p><i className="dot blue-dot"/><span>Tổng lượt chăm sóc</span><b>189</b></p><p><i className="dot green-dot"/><span>Mua lại / Hẹn mua</span><b>41</b></p><p><i className="dot orange-dot"/><span>Chưa liên lạc được</span><b>58</b></p></div></div>
        <div className="conversion"><span>Tỷ lệ chốt sau chăm sóc</span><strong>21,7% <small><ArrowUpRight size={13}/> 3,4%</small></strong><div><i/></div></div>
      </section>
      <section className="panel revenue-panel"><div className="panel-head"><div><h2>Doanh thu mua lại</h2><p>6 tháng gần nhất</p></div><div className="revenue-total"><small>TỔNG DOANH THU</small><strong>{money.format(1284500000)}</strong></div></div>
        <div className="chart"><div className="y-axis"><span>300tr</span><span>200tr</span><span>100tr</span><span>0</span></div><div className="bars">{[["T6",42],["T7",55],["T8",48],["T9",69],["T10",77],["T11",92]].map(([m,h])=><div className="bar-slot" key={m}><div className="bar" style={{height:`${h}%`}}>{m === "T11" && <em>284,5tr</em>}</div><span>{m}</span></div>)}</div></div>
      </section>
      <section className="panel alerts"><div className="panel-head"><div><h2>Cần chú ý</h2><p>Tín hiệu cần xử lý sớm</p></div></div><div className="alert-item"><div className="alert-icon red-bg"><TriangleAlert size={18}/></div><div><strong>2 phản ứng bất thường</strong><span>Cần liên hệ khách hàng ngay</span></div><ArrowRight size={18}/></div><div className="alert-item"><div className="alert-icon orange-bg"><ArrowDownRight size={18}/></div><div><strong>18 khách sắp hết liệu trình</strong><span>Trong 7 ngày tới</span></div><ArrowRight size={18}/></div><div className="alert-item"><div className="alert-icon green-bg"><CheckCircle2 size={18}/></div><div><strong>36 khách hàng hài lòng</strong><span>Điểm đánh giá 4–5</span></div><ArrowRight size={18}/></div></section>
    </div>
  </>;
}
