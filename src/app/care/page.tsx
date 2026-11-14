import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { getReportData, listCareTasks, listCustomers } from "@/lib/data-store";
import { CreateCareButton } from "@/components/create-care-button";
import { CareTaskActions } from "@/components/care-task-actions";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/users";
import { BulkCareButton } from "@/components/bulk-care-button";

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
  }>;
}) {
  const params = await searchParams,
    user = await getCurrentUser(),
    [allTasks, customers, allUsers, reportData] = await Promise.all([
      listCareTasks(user),
      listCustomers(undefined, user),
      listUsers(),
      getReportData(user),
    ]),
    today = new Date().toISOString().slice(0, 10);
  if (!hasPermission(user, "care")) redirect("/");
  const tasks = allTasks.filter(
    (item) =>
      (!params.date || item.dueAt.startsWith(params.date)) &&
      (!params.from || item.dueAt.slice(0, 10) >= `${params.from}-01`) &&
      (!params.to || item.dueAt.slice(0, 10) <= `${params.to}-31`) &&
      (!params.owner || item.owner === params.owner) &&
      (!params.status || item.status === params.status) &&
      (!params.task || item.id === params.task),
  );
  const displayedTasks = tasks.slice(0, 100);
  const employees = allUsers
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, name: item.name }));
  const products = Array.from(
    new Set(
      reportData.orders.flatMap((order) =>
        order.products.map((product) => product.name),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b, "vi"));
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
          <CreateCareButton customers={customers} employees={employees} orders={reportData.orders} />
        </div>
      </div>
      <section className="calendar-summary">
        <article>
          <Clock3 />
          <div>
            <strong>
              {allTasks.filter((item) => item.status === "overdue").length}
            </strong>
            <span>Đang quá hạn</span>
          </div>
        </article>
        <article>
          <CalendarDays />
          <div>
            <strong>
              {
                allTasks.filter(
                  (item) =>
                    item.status !== "done" && item.dueAt.startsWith(today),
                ).length
              }
            </strong>
            <span>Đến hạn hôm nay</span>
          </div>
        </article>
        <article>
          <CheckCircle2 />
          <div>
            <strong>
              {allTasks.filter((item) => item.status === "done").length}
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
                    <i>{item.owner.slice(-2).toUpperCase()}</i>
                    {item.owner}
                  </span>
                  <CareTaskActions task={item} employees={employees} />
                </div>
              </div>
            </article>
          ))}
          {tasks.length > displayedTasks.length && (
            <p className="list-limit-note">
              Đang hiển thị 100 nhiệm vụ ưu tiên đầu tiên trong {tasks.length} kết quả.
              Hãy chọn thời gian, nhân viên hoặc trạng thái để thu gọn danh sách.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
