import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";
import { CreateActivityButton } from "@/components/create-activity-button";
import { CreateCareButton } from "@/components/create-care-button";
import { StatusPill } from "@/components/status-pill";
import { getCarePageData, listProductCatalog } from "@/lib/data-store";
import { LazyCreateButton } from "@/components/lazy-create-button";
import { CareTaskActions } from "@/components/care-task-actions";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/users";
import { BulkCareButton } from "@/components/bulk-care-button";
import { Pagination } from "@/components/pagination";
import { MonthFilter } from "@/components/month-filter";
import { MonthShortcuts } from "@/components/month-shortcuts";
import { ImportCareButton } from "@/components/import-care-button";
import { CareProgramManager } from "@/components/care-program-manager";
import { recurrenceOptions } from "@/lib/care-recurrence";
import "../care-import.css";

export const dynamic = "force-dynamic";
function careDate(value: string) {
  const d = new Date(value);
  if (!Number.isNaN(d.getTime()))
    return {
      time: d.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Bangkok",
      }),
      date: d.toLocaleDateString("vi-VN", { timeZone: "Asia/Bangkok" }),
    };
  const p = value.split(",");
  return { time: (p[1] || value).trim(), date: (p[0] || "").trim() };
}
export default async function CarePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    owner?: string;
    status?: string;
    task?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams,
    user = await getCurrentUser();
  if (!user || !hasPermission(user, "care")) redirect("/");
  const [careData, allUsers, productCatalog] = await Promise.all([
      getCarePageData(params, user),
      listUsers(),
      listProductCatalog(),
    ]);
  const displayedTasks = careData.tasks;
  const employees = allUsers
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, name: item.name }));
  const products = productCatalog.map((item) => item.name);
  const formEmployees = ["admin", "super_admin"].includes(user.role) ? employees : employees.filter(employee => employee.id === user.id);
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">CHĂM SÓC KHÁCH HÀNG</p>
          <h1>Lịch chăm sóc</h1>
          <p>Nhiệm vụ chỉ hết cảnh báo khi được đánh dấu hoàn thành.</p>
        </div>
        <div className="page-actions">
          {user && ["admin", "super_admin"].includes(user.role) && <ImportCareButton />}
          {user && ["admin", "super_admin"].includes(user.role) && <CareProgramManager />}
          {user && ["admin", "super_admin"].includes(user.role) && (
            <BulkCareButton products={products} employees={employees} />
          )}
          <LazyCreateButton kind="care" />
        </div>
      </div>
      <section className="calendar-summary">
        <article>
          <Clock3 />
          <div>
            <strong>
              {careData.overdue.count}
            </strong>
            <span>Lịch quá hạn · {careData.overdue.customers} khách</span>
          </div>
        </article>
        <article>
          <CalendarDays />
          <div>
            <strong>
              {
                careData.today.count
              }
            </strong>
            <span>Lịch đến hạn hôm nay · {careData.today.customers} khách</span>
          </div>
        </article>
        <article>
          <CheckCircle2 />
          <div>
            <strong>
              {careData.done.count}
            </strong>
            <span>Lịch đã hoàn thành · {careData.done.customers} khách</span>
          </div>
        </article>
      </section>
      <section className="panel list-panel">
        <form className="list-toolbar" method="get">
          <label className="month-filter">Hoặc ngày hẹn cụ thể<input
            className="ghost-select"
            type="date"
            name="date"
            defaultValue={params.date}
            aria-label="Ngày hẹn cụ thể"
          /></label>
          <MonthFilter name="from" value={params.from} label="Từ tháng" />
          <MonthFilter name="to" value={params.to} label="Đến tháng" />
          {user && ["admin", "super_admin"].includes(user.role) && (
            <select
              className="ghost-select"
              name="owner"
              defaultValue={params.owner || ""}
            >
              <option value="">Tất cả nhân viên</option>
              {employees.map((employee) => (
                <option key={employee.id}>{employee.name}</option>
              ))}
            </select>
          )}
          <select
            className="ghost-select"
            name="status"
            defaultValue={params.status || ""}
          >
            <option value="">Mọi trạng thái</option>
            <option value="due">Đến hạn</option>
            <option value="overdue">Quá hạn</option>
            <option value="done">Đã hoàn thành</option>
          </select>
          <button className="secondary-button">Lọc nhiệm vụ</button>
          <MonthShortcuts resetPath="/care" />
        </form>
        <div className="care-list">
          {displayedTasks.map((item) => (
            <article key={item.id} className={`care-row ${item.status}`}>
              <div className="care-time">
                <strong>{careDate(item.dueAt).time}</strong>
                <span>{careDate(item.dueAt).date}</span>
              </div>
              <div className="care-line">
                <i />
              </div>
              <div className="care-body">
                <div>
                  <StatusPill status={item.status} />
                  {item.customerId ? <details className="care-row-details">
                    <summary>{item.purpose}</summary>
                    <div className="page-actions">
                      {hasPermission(user, "customers") && <Link className="secondary-button" href={`/customers/${encodeURIComponent(item.customerId)}?tab=care`}>Xem hồ sơ</Link>}
                      <CreateActivityButton customerId={item.customerId} orders={[]} task={item} employees={formEmployees.map(employee => employee.name)} />
                      <CreateCareButton
                        customerId={item.customerId}
                        customers={[{ id: item.customerId, name: item.customer, phone: item.phone, owner: item.owner }]}
                        employees={formEmployees}
                        preset={{ orderId: item.orderId, channel: item.channel }}
                        loadOrdersOnDemand
                      />
                    </div>
                  </details> : <h3>{item.purpose}</h3>}
                  <p>
                    {item.customer} · {item.phone}
                    {item.orderCode ? ` · Đơn ${item.orderCode}` : ""}
                    {item.productName ? ` · ${item.productName}` : ""}
                    {item.recurrence && item.recurrence !== "none"
                      ? ` · ${recurrenceOptions[item.recurrence]}`
                      : ""}
                  </p>
                </div>
                <div className="care-meta">
                  <span>{item.channel}</span>
                  <span className="person">
                    {item.owner}
                  </span>
                  <CareTaskActions task={item} employees={employees} />
                </div>
              </div>
            </article>
          ))}
          {!displayedTasks.length && <p className="no-data">Chưa có lịch phù hợp với bộ lọc.</p>}
        </div>
        <Pagination page={careData.page} size={careData.size} total={careData.total} pathname="/care" params={params} />
      </section>
    </>
  );
}
