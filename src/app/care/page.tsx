import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
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
    user = await getCurrentUser(),
    [careData, allUsers, productCatalog] = await Promise.all([
      getCarePageData(params, user),
      listUsers(),
      listProductCatalog(),
    ]);
  if (!hasPermission(user, "care")) redirect("/");
  const displayedTasks = careData.tasks;
  const employees = allUsers
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, name: item.name }));
  const products = productCatalog.map((item) => item.name);
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">CHĂM SÓC KHÁCH HÀNG</p>
          <h1>Lịch chăm sóc</h1>
          <p>Nhiệm vụ chỉ hết cảnh báo khi được đánh dấu hoàn thành.</p>
        </div>
        <div className="page-actions">
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
              {careData.overdue}
            </strong>
            <span>Đang quá hạn</span>
          </div>
        </article>
        <article>
          <CalendarDays />
          <div>
            <strong>
              {
                careData.today
              }
            </strong>
            <span>Đến hạn hôm nay</span>
          </div>
        </article>
        <article>
          <CheckCircle2 />
          <div>
            <strong>
              {careData.done}
            </strong>
            <span>Đã hoàn thành</span>
          </div>
        </article>
      </section>
      <section className="panel list-panel">
        <form className="list-toolbar" method="get">
          <input
            className="ghost-select"
            type="date"
            name="date"
            defaultValue={params.date}
          />
          <input
            className="ghost-select"
            type="month"
            name="from"
            defaultValue={params.from}
            aria-label="Từ tháng"
          />
          <input
            className="ghost-select"
            type="month"
            name="to"
            defaultValue={params.to}
            aria-label="Đến tháng"
          />
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
                  <h3>{item.purpose}</h3>
                  <p>
                    {item.customer} · {item.phone}
                    {item.orderCode ? ` · Đơn ${item.orderCode}` : ""}
                    {item.productName ? ` · ${item.productName}` : ""}
                    {item.recurrence && item.recurrence !== "none"
                      ? ` · Lặp ${item.recurrence === "monthly" ? "hàng tháng" : "hàng năm"}`
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
