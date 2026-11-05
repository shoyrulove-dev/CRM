import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { listCareTasks, listCustomers } from "@/lib/data-store";
import { CreateCareButton } from "@/components/create-care-button";
import { CareTaskActions } from "@/components/care-task-actions";

export const dynamic = "force-dynamic";
export default async function CarePage({ searchParams }: { searchParams: Promise<{ date?: string; owner?: string; status?: string }> }) {
  const params=await searchParams,[allTasks,customers]=await Promise.all([listCareTasks(),listCustomers()]),today=new Date().toISOString().slice(0,10);
  const tasks=allTasks.filter(item=>(!params.date||item.dueAt.startsWith(params.date))&&(!params.owner||item.owner===params.owner)&&(!params.status||item.status===params.status));
  return <><div className="page-heading compact"><div><p className="eyebrow">CHĂM SÓC KHÁCH HÀNG</p><h1>Lịch chăm sóc</h1><p>Nhiệm vụ chỉ hết cảnh báo khi được đánh dấu hoàn thành.</p></div><CreateCareButton customers={customers}/></div>
    <section className="calendar-summary"><article><Clock3/><div><strong>{allTasks.filter(item=>item.status==="overdue").length}</strong><span>Đang quá hạn</span></div></article><article><CalendarDays/><div><strong>{allTasks.filter(item=>item.status!=="done"&&item.dueAt.startsWith(today)).length}</strong><span>Đến hạn hôm nay</span></div></article><article><CheckCircle2/><div><strong>{allTasks.filter(item=>item.status==="done").length}</strong><span>Đã hoàn thành</span></div></article></section>
    <section className="panel list-panel"><form className="list-toolbar" method="get"><input className="ghost-select" type="date" name="date" defaultValue={params.date}/><select className="ghost-select" name="owner" defaultValue={params.owner||""}><option value="">Tất cả nhân viên</option>{["Vân Anh","Trâm","Linh","Ly","Phước An"].map(name=><option key={name}>{name}</option>)}</select><select className="ghost-select" name="status" defaultValue={params.status||""}><option value="">Mọi trạng thái</option><option value="due">Đến hạn</option><option value="overdue">Quá hạn</option><option value="done">Đã hoàn thành</option></select><button className="secondary-button">Lọc nhiệm vụ</button></form>
      <div className="care-list">{tasks.map(item=><article key={item.id} className={`care-row ${item.status}`}><div className="care-time"><strong>{new Date(item.dueAt).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"})}</strong><span>{new Date(item.dueAt).toLocaleDateString("vi-VN")}</span></div><div className="care-line"><i/></div><div className="care-body"><div><StatusPill status={item.status}/><h3>{item.purpose}</h3><p>{item.customer} · {item.phone}{item.recurrence&&item.recurrence!=="none"?` · Lặp ${item.recurrence==="monthly"?"hàng tháng":"hàng năm"}`:""}</p></div><div className="care-meta"><span>{item.channel}</span><span className="person"><i>{item.owner.slice(-2).toUpperCase()}</i>{item.owner}</span><CareTaskActions id={item.id} status={item.status}/></div></div></article>)}</div>
    </section></>;
}
