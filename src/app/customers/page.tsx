import { Download, Search } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/demo-data";
import { listCustomers } from "@/lib/data-store";
import { CreateCustomerButton } from "@/components/create-customer-button";

export const dynamic = "force-dynamic";
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; owner?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const all = await listCustomers(params.q);
  const filtered = all.filter(item => (!params.owner || item.owner === params.owner) && (!params.status || item.status === params.status));
  const size = 20, totalPages = Math.max(1, Math.ceil(filtered.length / size)), page = Math.min(totalPages, Math.max(1, Number(params.page) || 1));
  const customers = filtered.slice((page - 1) * size, page * size);
  const query = (next: Record<string, string | number | undefined>) => { const result = new URLSearchParams(); Object.entries({ ...params, ...next }).forEach(([key, value]) => { if (value) result.set(key, String(value)); }); return `?${result}`; };
  return <><div className="page-heading compact"><div><p className="eyebrow">QUẢN LÝ KHÁCH HÀNG</p><h1>Khách hàng</h1><p>Theo dõi hồ sơ, lịch sử mua hàng và hành trình chăm sóc.</p></div><CreateCustomerButton/></div>
    <section className="panel list-panel"><form className="list-toolbar" method="get"><div className="search-box"><Search size={18}/><input name="q" defaultValue={params.q} placeholder="Tìm tên, số điện thoại, mã khách hàng..."/></div><select className="ghost-select" name="owner" defaultValue={params.owner || ""}><option value="">Tất cả nhân viên</option>{["Vân Anh","Trâm","Linh","Ly","Phước An"].map(name => <option key={name}>{name}</option>)}</select><select className="ghost-select" name="status" defaultValue={params.status || ""}><option value="">Mọi trạng thái</option><option value="due">Cần chăm sóc</option><option value="overdue">Quá hạn</option><option value="done">Đã hoàn thành</option></select><button className="secondary-button">Lọc</button><Link className="secondary-button" href="/api/customers/export"><Download size={17}/>Xuất Excel</Link></form>
      <div className="filter-chips"><Link className={`chip ${!params.status ? "active" : ""}`} href={query({status:undefined,page:1})}>Tất cả <b>{all.length}</b></Link><Link className={`chip ${params.status === "due" ? "active" : ""}`} href={query({status:"due",page:1})}>Cần chăm sóc <b>{all.filter(item=>item.status==="due").length}</b></Link><Link className={`chip ${params.status === "overdue" ? "active" : ""}`} href={query({status:"overdue",page:1})}>Quá hạn <b>{all.filter(item=>item.status==="overdue").length}</b></Link></div>
      <div className="table-wrap customer-table"><table><thead><tr><th>KHÁCH HÀNG</th><th>PHÂN NHÓM</th><th>NHÂN VIÊN</th><th>ĐƠN HÀNG</th><th>DOANH THU</th><th>ĐƠN GẦN NHẤT</th><th>LỊCH TIẾP THEO</th><th/></tr></thead><tbody>{customers.map(item=><tr key={item.id}><td><Link href={`/customers/${item.id}`} className="customer-cell customer-link"><i>{item.name.split(" ").slice(-2).map(value=>value[0]).join("")}</i><span><strong>{item.name}</strong><small>{item.id} · {item.phone}</small></span></Link></td><td><span className="segment">{item.segment}</span><small>{item.healthGoal}</small></td><td><span className="person"><i>{item.owner.slice(-2).toUpperCase()}</i>{item.owner}</span></td><td><strong>{item.orders}</strong></td><td><strong>{money.format(item.revenue)}</strong></td><td>{item.lastOrder}</td><td><strong>{item.nextCare}</strong><StatusPill status={item.status}/></td><td><Link className="row-action detail-link" href={`/customers/${item.id}`}>Xem</Link></td></tr>)}</tbody></table></div>
      <div className="pagination"><span>Hiển thị {customers.length ? (page-1)*size+1 : 0}–{Math.min(page*size,filtered.length)} trên {filtered.length} khách hàng</span><div><Link className="secondary-button" href={query({page:Math.max(1,page-1)})}>‹</Link><span className="chip active">{page}/{totalPages}</span><Link className="secondary-button" href={query({page:Math.min(totalPages,page+1)})}>›</Link></div></div>
    </section></>;
}
