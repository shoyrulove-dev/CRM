import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, ListFilter } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { listCareTasks, listCustomers } from "@/lib/data-store";
import { CreateCareButton } from "@/components/create-care-button";
import { CareTaskActions } from "@/components/care-task-actions";

export const dynamic = "force-dynamic";

export default async function CarePage() {
  const [tasks, customers] = await Promise.all([listCareTasks(), listCustomers()]);
  const today = new Date().toISOString().slice(0, 10);
  return <>
    <div className="page-heading compact"><div><p className="eyebrow">CHĂM SÓC KHÁCH HÀNG</p><h1>Lịch chăm sóc</h1><p>Quản lý các mốc chăm sóc và công việc của đội ngũ.</p></div><CreateCareButton customers={customers}/></div>
    <section className="calendar-summary">
      <article><Clock3/><div><strong>{tasks.filter(t => t.status === "overdue").length}</strong><span>Đang quá hạn</span></div></article>
      <article><CalendarDays/><div><strong>{tasks.filter(t => t.status !== "done" && t.dueAt.startsWith(today)).length}</strong><span>Đến hạn hôm nay</span></div></article>
      <article><CheckCircle2/><div><strong>{tasks.filter(t => t.status === "done").length}</strong><span>Đã hoàn thành</span></div></article>
    </section>
    <section className="panel list-panel">
      <div className="list-toolbar"><div className="date-nav"><button><ChevronLeft/></button><strong>{new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(new Date())}</strong><button><ChevronRight/></button><button className="secondary-button">Hôm nay</button></div><button className="secondary-button"><ListFilter size={17}/>Lọc nhiệm vụ</button></div>
      <div className="care-list">{tasks.map(t => <article key={t.id} className={`care-row ${t.status}`}><div className="care-time"><strong>{t.dueAt.split(", ")[1] || "16:00"}</strong><span>{t.dueAt.split(", ")[0]}</span></div><div className="care-line"><i/></div><div className="care-body"><div><StatusPill status={t.status}/><h3>{t.purpose}</h3><p>{t.customer} · {t.phone}</p></div><div className="care-meta"><span>{t.channel}</span><span className="person"><i>{t.owner.slice(-2).toUpperCase()}</i>{t.owner}</span><CareTaskActions id={t.id} status={t.status}/></div></div></article>)}</div>
    </section>
  </>;
}
