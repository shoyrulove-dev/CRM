import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Headphones,
  PhoneCall,
  ShoppingBag,
  Target,
  TriangleAlert,
  UsersRound,
} from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/demo-data";
import { getReportData } from "@/lib/data-store";
import { roleLabel } from "@/lib/session";
import { getCurrentUser } from "@/lib/current-user";
export const dynamic = "force-dynamic";
function displayDue(value: string) {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime()))
    return parsed.toLocaleString("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Bangkok",
    });
  return value || "Chưa đặt thời hạn";
}
export default async function Dashboard() {
  const user = await getCurrentUser(),
    data = await getReportData(user),
    today = new Date().toISOString().slice(0, 10),
    month = today.slice(0, 7);
  const activities = data.activities.filter((x) =>
      x.occurredAt.startsWith(month),
    ),
    orders = data.orders.filter((x) => x.orderDate.startsWith(month)),
    openTasks = data.tasks.filter((x) => x.status !== "done"),
    overdue = openTasks.filter((x) => x.status === "overdue"),
    todayTasks = openTasks.filter(
      (x) => x.dueAt.startsWith(today) || x.dueAt.startsWith("Hôm nay"),
    );
  const contacted = activities.filter(
      (x) => x.contactStatus === "Liên lạc được",
    ).length,
    closed = activities.filter(
      (x) => x.result.includes("Mua lại") || x.result.includes("Hẹn mua"),
    ).length,
    revenue = orders
      .filter((x) => x.status === "Mua hàng")
      .reduce((s, x) => s + x.total, 0),
    repurchase = orders
      .filter((x) => x.purchaseType === "Mua lại" && x.status === "Mua hàng")
      .reduce((s, x) => s + x.total, 0);
  const contactRate = activities.length ? contacted / activities.length : 0,
    closeRate = activities.length ? closed / activities.length : 0,
    done = data.tasks.filter((x) => x.status === "done").length;
  const stats =
    user?.role === "sales"
      ? [
          {
            label: "Khách hàng phụ trách",
            value: String(data.customers.length),
            note: "Hồ sơ đang được giao",
            icon: UsersRound,
            tone: "blue",
          },
          {
            label: "Đơn hàng trong tháng",
            value: String(orders.length),
            note: money.format(revenue),
            icon: ShoppingBag,
            tone: "violet",
          },
          {
            label: "Khách mua lại",
            value: String(
              orders.filter((x) => x.purchaseType === "Mua lại").length,
            ),
            note: money.format(repurchase),
            icon: CircleDollarSign,
            tone: "green",
          },
          {
            label: "Việc cần xử lý",
            value: String(openTasks.length),
            note: `${overdue.length} việc quá hạn`,
            icon: CalendarCheck2,
            tone: "orange",
          },
        ]
      : [
          {
            label:
              user?.role === "admin"
                ? "Tổng khách hàng"
                : "Khách hàng phụ trách",
            value: String(data.customers.length),
            note: "Hồ sơ đang theo dõi",
            icon: UsersRound,
            tone: "blue",
          },
          {
            label: "Cần làm hôm nay",
            value: String(todayTasks.length),
            note: `${overdue.length} việc quá hạn`,
            icon: CalendarCheck2,
            tone: "orange",
          },
          {
            label: "Tỷ lệ liên lạc",
            value: `${(contactRate * 100).toFixed(1)}%`,
            note: `${contacted}/${activities.length} lượt trong tháng`,
            icon: PhoneCall,
            tone: "green",
          },
          {
            label: "Tỷ lệ có kết quả",
            value: `${(closeRate * 100).toFixed(1)}%`,
            note: `${closed} lượt mua lại / hẹn mua`,
            icon: Target,
            tone: "violet",
          },
        ];
  return (
    <>
      <section className="dashboard-welcome">
        <div>
          <p>
            {user ? roleLabel(user.role) : "Nichiei CRM"} ·{" "}
            {new Intl.DateTimeFormat("vi-VN", { dateStyle: "full" }).format(
              new Date(),
            )}
          </p>
          <h1>Chào {user?.name || "bạn"}, hôm nay cần ưu tiên gì?</h1>
          <span>
            {overdue.length
              ? `Có ${overdue.length} công việc quá hạn cần xử lý trước.`
              : "Mọi công việc đang đúng tiến độ."}
          </span>
        </div>
        <div className="welcome-actions">
          <Link className="secondary-button" href="/customers">
            Xem khách hàng
          </Link>
          <Link className="primary-button" href="/care">
            <CalendarCheck2 size={17} />
            Mở lịch chăm sóc
          </Link>
        </div>
      </section>
      <section className="stat-grid">
        {stats.map((s) => {
          const I = s.icon;
          return (
            <article className="stat-card" key={s.label}>
              <div className={`stat-icon ${s.tone}`}>
                <I size={20} />
              </div>
              <div className="stat-main">
                <span>{s.label}</span>
                <strong>{s.value}</strong>
                <small>{s.note}</small>
              </div>
            </article>
          );
        })}
      </section>
      <div className="saas-dashboard-grid">
        <section className="panel dashboard-priority">
          <div className="panel-head">
            <div>
              <h2>Hàng đợi công việc</h2>
              <p>Sắp xếp theo việc quá hạn và gần đến giờ</p>
            </div>
            <Link href="/care">
              Xem tất cả <ArrowRight size={15} />
            </Link>
          </div>
          <div className="task-summary">
            <span>
              <b className="red">{overdue.length}</b> Quá hạn
            </span>
            <span>
              <b>{todayTasks.length}</b> Hôm nay
            </span>
            <span>
              <b className="green-text">{done}</b> Hoàn thành
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>KHÁCH HÀNG</th>
                  <th>CÔNG VIỆC</th>
                  <th>THỜI HẠN</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {openTasks.slice(0, 7).map((x) => (
                  <tr key={x.id}>
                    <td>
                      <strong>{x.customer}</strong>
                      <small>{x.phone}</small>
                    </td>
                    <td>
                      {x.purpose}
                      <small>{x.channel}</small>
                    </td>
                    <td className={x.status === "overdue" ? "danger-text" : ""}>
                      <Clock3 size={14} />
                    {displayDue(x.dueAt)}
                    </td>
                    <td>
                      <StatusPill status={x.status} />
                    </td>
                  </tr>
                ))}
                {!openTasks.length && (
                  <tr>
                    <td colSpan={4}>
                      <div className="dashboard-empty">
                        <CheckCircle2 />
                        Không còn công việc chờ xử lý
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="dashboard-side">
          <section className="panel progress-card">
            <div className="panel-head">
              <div>
                <h2>Hiệu quả tháng này</h2>
                <p>Số liệu theo tài khoản đang đăng nhập</p>
              </div>
            </div>
            <div className="progress-metric">
              <div>
                <span>Liên lạc được</span>
                <b>{(contactRate * 100).toFixed(1)}%</b>
              </div>
              <i>
                <em style={{ width: `${contactRate * 100}%` }} />
              </i>
              <small>
                {contacted} trên {activities.length} lượt chăm sóc
              </small>
            </div>
            <div className="progress-metric">
              <div>
                <span>Có kết quả mua lại / hẹn mua</span>
                <b>{(closeRate * 100).toFixed(1)}%</b>
              </div>
              <i>
                <em
                  className="green-bar"
                  style={{ width: `${closeRate * 100}%` }}
                />
              </i>
              <small>{closed} lượt có kết quả</small>
            </div>
          </section>
          <section className="panel focus-card">
            <div className="panel-head">
              <div>
                <h2>Cần chú ý</h2>
                <p>Tín hiệu cần theo dõi</p>
              </div>
            </div>
            <Link href="/care">
              <TriangleAlert className="danger-text" />
              <span>
                <b>{overdue.length} việc quá hạn</b>
                <small>Ưu tiên xử lý trước</small>
              </span>
              <ArrowRight />
            </Link>
            <Link href="/reports">
              <Headphones />
              <span>
                <b>
                  {activities.filter((x) => x.adverseReaction).length} phản ứng
                  bất thường
                </b>
                <small>Kiểm tra lịch sử chăm sóc</small>
              </span>
              <ArrowRight />
            </Link>
            <Link href="/customers">
              <ShoppingBag />
              <span>
                <b>
                  {data.customers.filter((x) => x.status === "overdue").length}{" "}
                  khách cần liên hệ
                </b>
                <small>Xem danh sách phụ trách</small>
              </span>
              <ArrowRight />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
