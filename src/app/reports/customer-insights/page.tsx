import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll, hasPermission } from "@/lib/session";
import { reportPeriod } from "@/lib/report-filters";
import { customerReportViews, isCustomerReportView } from "@/lib/customer-report-metrics";
import { getCustomerReport, reviewPeriods } from "@/lib/customer-report-data";
import { Pagination } from "@/components/pagination";

export const dynamic = "force-dynamic";
const pathname = "/reports/customer-insights";

export default async function CustomerInsightsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; from?: string; to?: string; owner?: string; customer?: string; product?: string; unit?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports")) redirect("/");
  const params = await searchParams;
  const manager = canSeeAll(user);
  const view = isCustomerReportView(params.view) ? params.view : "care-days";
  const sales = view === "sales-review" || view === "sales-orders";
  if (sales && !manager) redirect(pathname);
  const period = reportPeriod(params.from, params.to);
  if (!period) return <section className="panel report-formula"><p>Khoảng ngày không hợp lệ. Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.</p><Link href={pathname}>Chọn lại bộ lọc</Link></section>;
  const { from, to } = period;
  const filters = {
    from, to, owner: manager ? params.owner || "" : "",
    customer: sales || view === "care-days" ? "" : (params.customer || "").trim().slice(0, 100),
    product: sales || view === "care-days" ? "" : (params.product || "").trim().slice(0, 100),
    unit: params.unit && Object.hasOwn(reviewPeriods, params.unit) ? params.unit : "month",
  };
  const report = await getCustomerReport(view, filters, user);
  const size = 25;
  const page = Math.min(Math.max(1, Math.ceil(report.rows.length / size)), Math.max(1, Math.floor(Number(params.page) || 1)));
  const pagination = { view, ...filters };
  const exportQuery = new URLSearchParams({ ...filters, template: view });
  const viewFilter = { from, to };
  return <>
    <div className="page-heading compact">
      <div><p className="eyebrow">PHÂN TÍCH KHÁCH HÀNG</p><h1>{customerReportViews[view]}</h1></div>
      <Link className="secondary-button" href={`/reports?${new URLSearchParams(viewFilter)}`}>Báo cáo tổng quan</Link>
    </div>
    <div className="filter-chips">
      {Object.entries(customerReportViews).filter(([key]) => manager || !key.startsWith("sales-")).map(([key, label]) =>
        <Link key={key} className={`chip ${key === view ? "active" : ""}`} aria-current={key === view ? "page" : undefined}
          href={`${pathname}?${new URLSearchParams({ ...viewFilter, view: key, unit: filters.unit })}`}>{label}</Link>)}
    </div>
    <form className="panel report-filter" method="get">
      <input type="hidden" name="view" value={view} />
      <label>Từ ngày<input name="from" type="date" defaultValue={from} required /></label>
      <label>Đến ngày<input name="to" type="date" defaultValue={to} required /></label>
      {manager && <label>{sales ? "Nhân viên bán" : "Nhân viên"}
        <select name="owner" defaultValue={filters.owner}>
          <option value="">Tất cả nhân viên</option>
          {report.employees.map(name => <option key={name}>{name}</option>)}
        </select>
      </label>}
      {view === "sales-review" && <label>Nhóm theo
        <select name="unit" defaultValue={filters.unit}>{Object.entries(reviewPeriods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </label>}
      {!sales && view !== "care-days" && <>
        <label>Khách hàng<input name="customer" placeholder="Tên hoặc mã khách" defaultValue={filters.customer} maxLength={100} /></label>
        <label>Sản phẩm<input name="product" placeholder="Tên hoặc SKU" defaultValue={filters.product} maxLength={100} /></label>
      </>}
      <button className="secondary-button">Xem báo cáo</button>
      <a className="secondary-button" href={`/api/reports/export?${exportQuery}`}>Xuất Excel</a>
    </form>
    <p className="report-formula">
      {sales ? "Tạm tính theo lịch sử đơn có trong CRM. Tỷ lệ khách mua lần đầu tính trên khách có đơn trong kỳ. Một khách có thể mua lần đầu rồi mua lại trong cùng kỳ."
        : view === "care-days" ? "Mỗi khách chỉ tính một lần mỗi ngày theo giờ Việt Nam. Lượt chăm sóc tính theo số nhật ký đã ghi."
          : "Mỗi đơn mua có SKU được tính một lần cho khách và sản phẩm đó. Các dòng thiếu SKU, đơn hủy và đơn trả hàng được loại khỏi báo cáo."}
    </p>
    <section className="panel list-panel">
      <div className="table-wrap">
        <table>
          <thead><tr>{report.headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {report.rows.slice((page - 1) * size, page * size).map((row, index) =>
              <tr key={index}>{row.map((cell, column) => <td key={column}>{cell}</td>)}</tr>)}
            {!report.rows.length && <tr><td colSpan={report.headers.length}>Chưa có dữ liệu theo bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} size={size} total={report.rows.length} pathname={pathname} params={pagination} />
    </section>
  </>;
}
