import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ContactRound,
  PhoneCall,
  ShoppingCart,
} from "lucide-react";
import { getReportData } from "@/lib/data-store";
import { money } from "@/lib/demo-data";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { redirect } from "next/navigation";
import { ReportExportButton } from "@/components/report-export-button";
import { reportPeriod, reportInRange } from "@/lib/report-filters";
import { retentionMetrics } from "@/lib/retention-metrics";
import Link from "next/link";
import { careCoverage } from "@/lib/care-coverage";
import { Pagination } from "@/components/pagination";
import { loadPurchaseHistory } from "@/lib/purchase-history";

export const dynamic = "force-dynamic";
const inRange = reportInRange;
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; owner?: string; orders?: string; page?: string }>;
}) {
  const params = await searchParams, user = await getCurrentUser();
  if (!hasPermission(user, "reports")) redirect("/");
  const period = reportPeriod(params.from, params.to);
  if (!period) return <section className="panel"><h1>Khoảng ngày không hợp lệ</h1><p>Chọn ngày hợp lệ, từ ngày không sau đến ngày.</p></section>;
  const { from, to, previousFrom, previousTo } = period;
  const showOrders = params.orders === "1";
  const data = await getReportData(user, { summary: true, includeOrderCodes: showOrders, sections: ["customers", "tasks", "activities", "orders"] });
  const history = await loadPurchaseHistory(data.orders.map(order => order.customerId).filter(Boolean));
  data.orders = data.orders.map(order => {
    const first = history.get(order.customerId);
    return first && first.day < order.orderDate.slice(0, 10) ? { ...order, purchaseType: "Mua lại" } : order;
  });
  const employees = Array.from(
    new Set(
      [
        ...data.customers.map((item) => item.owner),
        ...data.tasks.map((item) => item.owner),
        ...data.activities.map((item) => item.employee),
        ...data.orders.map((item) => item.salesperson),
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "vi"));
  const selectedEmployee = !user || ["admin", "super_admin"].includes(user.role) ? params.owner : user.name;
  const employeeMatches = (value: string) => !selectedEmployee || value === selectedEmployee;
  const orderMatches = (item: { salesperson: string }) => !selectedEmployee || item.salesperson === selectedEmployee;
  const activities = data.activities.filter(
      (item) =>
        inRange(item.occurredAt, from, to) &&
        employeeMatches(item.employee),
    ),
    previousActivities = data.activities.filter((item) =>
      inRange(item.occurredAt, previousFrom, previousTo) && employeeMatches(item.employee),
    );
  const orders = data.orders.filter((item) =>
      inRange(item.orderDate, from, to) && orderMatches(item),
    ),
    previousOrders = data.orders.filter((item) =>
      inRange(item.orderDate, previousFrom, previousTo) && orderMatches(item),
    );
  const tasks = data.tasks.filter((item) => inRange(item.dueAt, from, to) && employeeMatches(item.owner));
  const rows = employees.filter(employeeMatches).map((name) => {
    const care = activities.filter((item) => item.employee === name),
      contacted = care.filter(
        (item) => item.contactStatus === "Liên lạc được",
      ).length,
      buy = care.filter((item) => item.result.includes("Mua lại")).length,
      appointments = care.filter((item) =>
        item.result.includes("Hẹn mua"),
      ).length,
      reminders = care.filter((item) => item.purpose.includes("Nhắc tái mua")),
      assigned = tasks.filter((item) => item.owner === name),
      satisfaction = care.flatMap((item) =>
        item.satisfaction ? [item.satisfaction] : [],
      );
    return {
      name,
      care: care.length,
      customers: new Set(care.map((item) => item.customerId)).size,
      contacted,
      contactRate: care.length ? contacted / care.length : 0,
      buy,
      appointments,
      closeRate: care.length ? (buy + appointments) / care.length : 0,
      reminders: reminders.length,
      timely: reminders.filter((item) => item.repurchaseTimely).length,
      adverse: care.filter((item) => item.adverseReaction).length,
      satisfaction: satisfaction.length
        ? satisfaction.reduce((a, b) => a + b, 0) / satisfaction.length
        : 0,
      done: assigned.filter((item) => item.status === "done").length,
      tasks: assigned.length,
      coverage: careCoverage(assigned, care),
    };
  });
  const repurchaseRevenue = orders
      .filter(
        (item) => item.purchaseType === "Mua lại" && item.status === "Mua hàng",
      )
      .reduce((sum, item) => sum + item.total, 0),
    previousRevenue = previousOrders
      .filter(
        (item) => item.purchaseType === "Mua lại" && item.status === "Mua hàng",
      )
      .reduce((sum, item) => sum + item.total, 0);
  const contactRate = activities.length
    ? activities.filter((item) => item.contactStatus === "Liên lạc được")
        .length / activities.length
    : 0;
  const purchasedOrders = orders.filter((item) => item.status === "Mua hàng");
  if (showOrders) purchasedOrders.sort((a, b) => b.orderDate.localeCompare(a.orderDate) || (a.code || "").localeCompare(b.code || ""));
  const orderSize = 25;
  const orderPage = Math.min(Math.max(1, Math.floor(Number(params.page) || 1)), Math.max(1, Math.ceil(purchasedOrders.length / orderSize)));
  const orderParams = { from, to, owner: params.owner, orders: "1" };
  const orderLink = new URLSearchParams({ from, to, ...(params.owner ? { owner: params.owner } : {}), orders: "1" });
  const { customersWithOrders, multiBuyers, repurchaseRate, cumulativeBuyers, cumulativeRepeat } = retentionMetrics(data.orders.filter(orderMatches), from, to);
  const dueForRepurchase = activities.filter(
      (item) => item.productEndDate && inRange(item.productEndDate, from, to),
    ).length,
    timelyReminders = activities.filter(
      (item) => item.purpose.includes("Nhắc tái mua") && item.repurchaseTimely,
    ).length,
    totalReminders = activities.filter((item) =>
      item.purpose.includes("Nhắc tái mua"),
    ).length;
  const taskCompletion = tasks.length
      ? tasks.filter((item) => item.status === "done").length / tasks.length
      : 0,
    timelyRate = totalReminders ? timelyReminders / totalReminders : 0;
  const channels = ["Gọi điện", "Zalo", "Facebook", "SMS", "Trực tiếp"].map(
    (channel) => {
      const items = activities.filter((item) => item.channel === channel),
        contacted = items.filter(
          (item) => item.contactStatus === "Liên lạc được",
        ).length,
        closed = items.filter(
          (item) =>
            item.result.includes("Mua lại") || item.result.includes("Hẹn mua"),
        ).length;
      return {
        channel,
        total: items.length,
        contactRate: items.length ? contacted / items.length : 0,
        closeRate: items.length ? closed / items.length : 0,
      };
    },
  );
  const reasons = [
    "Chưa dùng hết",
    "Giá cao",
    "Chưa thấy hiệu quả",
    "Sợ lừa đảo",
    "Mua qua đại lý / nơi khác",
    "Người dùng tạm ngưng",
    "Phản ứng không mong muốn",
    "Khác",
  ];
  const metric = (
    label: string,
    current: number,
    previous: number,
    format = (value: number) => String(value),
  ) => (
    <tr>
      <td>{label}</td>
      <td>
        <strong>{format(current)}</strong>
      </td>
      <td>{format(previous)}</td>
      <td className={current >= previous ? "green-text" : "danger-text"}>
        {current >= previous ? "+" : ""}
        {format(current - previous)}
      </td>
    </tr>
  );
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">PHÂN TÍCH HIỆU QUẢ</p>
          <h1>Báo cáo chăm sóc khách hàng</h1>
          <p>
            {new Date(from).toLocaleDateString("vi-VN")} đến{" "}
            {new Date(to).toLocaleDateString("vi-VN")} · so sánh với kỳ liền
            trước
          </p>
        </div>
        <div className="page-actions">
          <Link className="secondary-button" href={`/reports/customer-insights?${new URLSearchParams({ from, to, ...(params.owner ? { owner: params.owner } : {}) })}`}>Báo cáo khách và sản phẩm</Link>
          <ReportExportButton from={from} to={to} owner={params.owner} />
        </div>
      </div>
      <form className="panel report-filter" method="get">
        <label>
          Từ ngày
          <input type="date" name="from" defaultValue={from} />
        </label>
        {user && ["admin", "super_admin"].includes(user.role) && (
          <label>
            Nhân viên
            <select name="owner" defaultValue={params.owner || ""}>
              <option value="">Tất cả nhân viên</option>
              {employees.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Đến ngày
          <input type="date" name="to" defaultValue={to} />
        </label>
        <button className="primary-button">Áp dụng</button>
      </form>
      <section className="report-kpis">
        <article>
          <ContactRound />
          <div>
            <span>Khách đã chăm sóc</span>
            <strong>
              {new Set(activities.map((item) => item.customerId)).size}
            </strong>
          </div>
        </article>
        <article>
          <PhoneCall />
          <div>
            <span>Tỷ lệ liên lạc</span>
            <strong>{(contactRate * 100).toFixed(1)}%</strong>
          </div>
        </article>
        <article>
          <ShoppingCart />
          <div>
            <span>Doanh thu mua lại</span>
            <strong>{money.format(repurchaseRevenue)}</strong>
          </div>
        </article>
        <article>
          <AlertTriangle />
          <div>
            <span>Phản ứng bất thường</span>
            <strong>
              {activities.filter((item) => item.adverseReaction).length}
            </strong>
          </div>
        </article>
      </section>
      <section className="panel report-panel">
        <div className="panel-head">
          <div>
            <h2>Kết quả theo nhân viên</h2>
            <p>Tỷ lệ đã chăm chỉ tính khách có lịch đến hạn và có nhật ký của nhân viên trong cùng kỳ.</p>
            <p>
              Tổng hợp công việc và kết quả chăm sóc trong thời gian đã chọn.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>NHÂN VIÊN</th>
                <th>KHÁCH CẦN CHĂM</th>
                <th>LƯỢT CHĂM</th>
                <th>SỐ KHÁCH</th>
                <th>ĐÃ CHĂM / CẦN CHĂM</th>
                <th>LIÊN LẠC</th>
                <th>TỶ LỆ</th>
                <th>MUA LẠI</th>
                <th>HẸN MUA</th>
                <th>TỶ LỆ CHỐT</th>
                <th>NHẮC TÁI MUA</th>
                <th>ĐÚNG LÚC</th>
                <th>BẤT THƯỜNG</th>
                <th>HÀI LÒNG</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <td>
                    <strong>{row.name}</strong>
                  </td>
                  <td>{row.coverage.due}</td>
                  <td>{row.care}</td>
                  <td>{row.customers}</td>
                  <td>{row.coverage.rate === null ? "—" : `${row.coverage.reached}/${row.coverage.due} (${(row.coverage.rate * 100).toFixed(1)}%)`}</td>
                  <td>{row.contacted}</td>
                  <td>{(row.contactRate * 100).toFixed(1)}%</td>
                  <td>{row.buy}</td>
                  <td>{row.appointments}</td>
                  <td>{(row.closeRate * 100).toFixed(1)}%</td>
                  <td>{row.reminders}</td>
                  <td>{row.timely}</td>
                  <td className={row.adverse ? "danger-text" : ""}>
                    {row.adverse}
                  </td>
                  <td>
                    {row.satisfaction
                      ? `${row.satisfaction.toFixed(1)} / 5`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="report-grid">
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <h2>Báo cáo kỳ và so sánh</h2>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>CHỈ SỐ</th>
                <th>KỲ NÀY</th>
                <th>KỲ TRƯỚC</th>
                <th>CHÊNH LỆCH</th>
              </tr>
            </thead>
            <tbody>
              {metric("Số đơn", orders.length, previousOrders.length)}
              {metric(
                "Doanh thu mua lại",
                repurchaseRevenue,
                previousRevenue,
                (value) => money.format(value),
              )}
              {metric(
                "Khách mới",
                orders.filter((item) => item.purchaseType === "Mua mới").length,
                previousOrders.filter((item) => item.purchaseType === "Mua mới")
                  .length,
              )}
              {metric(
                "Lượt chăm sóc",
                activities.length,
                previousActivities.length,
              )}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Kỷ luật chăm sóc</h2>
            </div>
          </div>
          <div className="discipline-list">
            <p>
              <CalendarCheck2 />
              <span>Nhiệm vụ trong kỳ</span>
              <b>{tasks.length}</b>
            </p>
            <p>
              <CheckCircle2 />
              <span>Đã hoàn thành</span>
              <b>
                {tasks.filter((item) => item.status === "done").length} (
                {(taskCompletion * 100).toFixed(1)}%)
              </b>
            </p>
            <p>
              <AlertTriangle />
              <span>Đang quá hạn</span>
              <b className="danger-text">
                {tasks.filter((item) => item.status === "overdue").length}
              </b>
            </p>
            <p>
              <CheckCircle2 />
              <span>Nhắc tái mua đúng lúc</span>
              <b>
                {timelyReminders}/{totalReminders} (
                {(timelyRate * 100).toFixed(1)}%)
              </b>
            </p>
          </div>
        </section>
      </div>
      <div className="report-grid">
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <h2>Giữ chân và tái mua</h2>
              <p>Các chỉ số trong kỳ dùng cùng bộ lọc ngày và nhân viên. Mỗi khách chỉ tính một lần.</p>
            </div>
          </div>
          <table>
            <tbody>
              <tr>
                <td>Khách có đơn mua trong kỳ</td>
                <td>
                  <b>{customersWithOrders}</b>
                </td>
              </tr>
              <tr>
                <td>Khách tái mua trong kỳ</td>
                <td>
                  <b>{multiBuyers}</b>
                </td>
              </tr>
              <tr>
                <td>Tỷ lệ khách tái mua trong kỳ</td>
                <td>
                  <b>{(repurchaseRate * 100).toFixed(1)}%</b> · Mục tiêu 35% ·{" "}
                  <span
                    className={
                      repurchaseRate >= 0.35 ? "green-text" : "danger-text"
                    }
                  >
                    {repurchaseRate >= 0.35 ? "Đạt" : "Chưa đạt"}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Đơn mua trong kỳ <Link href={`/reports?${orderLink}#orders-in-period`}>Xem từng đơn</Link></td>
                <td>
                  <b>{purchasedOrders.length}</b>
                </td>
              </tr>
              <tr><td>Khách từng mua — lũy kế đến cuối kỳ</td><td><b>{cumulativeBuyers}</b></td></tr>
              <tr><td>Khách có ít nhất 2 đơn — lũy kế đến cuối kỳ</td><td><b>{cumulativeRepeat}</b></td></tr>
              <tr>
                <td>Lượt đến hạn hết liệu trình</td>
                <td>
                  <b>{dueForRepurchase}</b>
                </td>
              </tr>
              <tr>
                <td>Doanh thu mua lại</td>
                <td>
                  <b>{money.format(repurchaseRevenue)}</b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="report-formula">Doanh thu mua lại = tổng giá trị đơn Mua lại có trạng thái Mua hàng trong kỳ. Đơn hủy/đơn trả hàng không được cộng. Chỉ số này không chứng minh doanh thu phát sinh nhờ CSKH và chưa khấu trừ hoàn tiền từng phần nếu Haravan chưa cung cấp số liệu đó. Khách tái mua trong kỳ là khách có ít nhất một đơn Mua lại trong kỳ.</p>
        </section>
        <section className="panel report-panel">
          <div className="panel-head">
            <div>
              <h2>Hiệu quả theo kênh</h2>
              <p>Liên lạc và chốt theo từng kênh chăm sóc</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>KÊNH</th>
                <th>LƯỢT</th>
                <th>LIÊN LẠC</th>
                <th>CHỐT</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((item) => (
                <tr key={item.channel}>
                  <td>{item.channel}</td>
                  <td>{item.total}</td>
                  <td>{(item.contactRate * 100).toFixed(1)}%</td>
                  <td>{(item.closeRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <section className="panel report-panel">
        <div className="panel-head">
          <div>
            <h2>Lý do khách chưa mua lại</h2>
          </div>
        </div>
        <div className="reason-bars">
          {reasons.map((reason) => {
            const count = activities.filter(
              (item) => item.noPurchaseReason === reason,
            ).length;
            return (
              <div key={reason}>
                <span>{reason}</span>
                <div>
                  <i
                    style={{
                      width: `${activities.length ? Math.max(3, (count / activities.length) * 100) : 3}%`,
                    }}
                  />
                </div>
                <b>{count}</b>
              </div>
            );
          })}
        </div>
      </section>
      {showOrders && <section id="orders-in-period" className="panel list-panel">
        <div className="panel-head"><div><h2>Đơn mua từ {from} đến {to}</h2>
          <p>Đếm theo ngày tạo đơn (giờ Việt Nam), trạng thái Mua hàng và người bán trên đơn.</p></div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Mã đơn</th><th>Ngày đơn CRM</th><th>Người bán</th><th>Người phụ trách</th><th>Doanh số</th></tr></thead>
          <tbody>
            {purchasedOrders.slice((orderPage - 1) * orderSize, orderPage * orderSize).map(item =>
              <tr key={item.id}><td>{item.code}</td><td>{item.orderDate}</td><td>{item.salesperson}</td><td>{item.owner}</td><td>{money.format(item.total)}</td></tr>)}
            {!purchasedOrders.length && <tr><td colSpan={5}>Không có đơn mua trong kỳ đã chọn.</td></tr>}
          </tbody>
        </table></div>
        <Pagination page={orderPage} size={orderSize} total={purchasedOrders.length} pathname="/reports" params={orderParams} />
      </section>}
    </>
  );
}
