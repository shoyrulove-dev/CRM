import { NextRequest } from "next/server";
import { getReportData } from "@/lib/data-store";
import { effectiveReportOrders } from "@/lib/order-report-adjustment";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse, type ExcelCell } from "@/lib/excel";
import { canSeeAll, hasPermission } from "@/lib/session";
import { validDay } from "@/lib/month-range";
import { reportInRange, reportPeriod } from "@/lib/report-filters";
import { isCustomerReportView, customerReportViews } from "@/lib/customer-report-metrics";
import { getCustomerReport, reviewPeriods } from "@/lib/customer-report-data";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "reports")) return new Response("Không có quyền xuất báo cáo.", { status: 403 });
  const p = request.nextUrl.searchParams, from = p.get("from"), to = p.get("to"),
    owner = user && !["admin", "super_admin"].includes(user.role) ? user.name : p.get("owner"), template = p.get("template") || "detail";
  if ((from && !validDay(from)) || (to && !validDay(to)) || (from && to && from > to))
    return new Response("Khoảng ngày không hợp lệ.", { status: 400 });
  if (isCustomerReportView(template)) {
    const sales = template === "sales-review" || template === "sales-orders";
    if (sales && !canSeeAll(user)) return new Response("Không có quyền xuất báo cáo đối chiếu.", { status: 403 });
    const period = reportPeriod(from || undefined, to || undefined);
    if (!period) return new Response("Khoảng ngày không hợp lệ.", { status: 400 });
    const unit = p.get("unit") || "month";
    const { headers, rows } = await getCustomerReport(template, {
      from: period.from, to: period.to, owner: owner || "",
      customer: (p.get("customer") || "").trim().slice(0, 100),
      product: (p.get("product") || "").trim().slice(0, 100),
      unit: Object.hasOwn(reviewPeriods, unit) ? unit : "month",
    }, user);
    const file = await createExcelFile(customerReportViews[template].slice(0, 31), headers, rows);
    return excelResponse(file, `${template}-${period.from}-${period.to}.xlsx`);
  }
  const sections: Array<"customers" | "tasks" | "activities" | "orders" | "tickets"> = template === "orders" ? ["customers", "orders"]
    : template === "customers" ? ["customers"] : template === "tickets" ? ["tickets"] : ["activities"];
  const data = await getReportData(user, { sections });
  const inRange = (value: string) => reportInRange(value, from || undefined, to || undefined);
  let name = "Chi tiết chăm sóc", headers: string[], rows: ExcelCell[][];
  if (template === "orders") {
    name = "Đơn hàng Haravan";
    headers = ["Ngày tạo", "Tháng", "Kênh bán", "Mã đơn hàng", "Tên khách", "Số điện thoại", "Tình trạng", "Sản phẩm", "Số lượng", "Tổng thanh toán", "Phụ trách CRM", "Người bán Haravan"];
    const customerById = new Map(data.customers.map((item) => [item.id, item]));
    rows = effectiveReportOrders(data.orders).filter((item) => inRange(item.orderDate) && (!owner || item.owner === owner)).flatMap((item) => {
      const customer = customerById.get(item.customerId);
      const products = item.products.length ? item.products : [{ name: "", quantity: 0 }];
      return products.map((product, index) => [item.orderDate, item.orderDate.slice(0, 7), item.channel, item.code, customer?.name || "", customer?.phone || "", item.status, product.name, product.quantity, index === 0 ? item.total : "", item.owner, item.salesperson]);
    });
  } else if (template === "employee") {
    name = "Hiệu quả nhân viên"; headers = ["Nhân viên", "Lượt chăm sóc", "Số khách", "Liên lạc được", "Mua lại / hẹn mua", "Phản ứng bất thường"];
    const items = data.activities.filter((item) => inRange(item.occurredAt) && (!owner || item.employee === owner));
    const employees = [...new Set(items.map((item) => item.employee))];
    rows = employees.map((employee) => { const own = items.filter((item) => item.employee === employee); return [employee, own.length, new Set(own.map((item) => item.customerId)).size, own.filter((item) => item.contactStatus === "Liên lạc được").length, own.filter((item) => item.result.includes("Mua lại") || item.result.includes("Hẹn mua")).length, own.filter((item) => item.adverseReaction).length]; });
  } else if (template === "customers") {
    name = "Tổng hợp khách hàng"; headers = ["Mã khách", "Khách hàng", "Số điện thoại", "Phụ trách", "Phân nhóm", "Số đơn", "Doanh thu", "Đơn gần nhất", "Lịch chăm sóc tiếp theo"];
    rows = data.customers.filter((item) => !owner || item.owner === owner).map((item) => [item.id, item.name, item.phone, item.owner, item.segment, item.orders, item.revenue, item.lastOrder, item.nextCare]);
  } else if (template === "tickets") {
    name = "Phiếu yêu cầu"; headers = ["Mã phiếu", "Ngày tạo", "Khách hàng", "Nội dung", "Ưu tiên", "Trạng thái", "Hướng xử lý", "Phụ trách", "Mã đơn", "Sản phẩm thu/đổi", "Sản phẩm đổi sang"];
    rows = data.tickets.filter((item) => inRange(item.createdAt) && (!owner || item.owner === owner)).map((item) => [item.id, item.createdAt, item.customer, item.title, item.priority, item.status, item.resolution || "", item.owner, item.orderCode || "", item.returnProductName || "", item.exchangeProductName || ""]);
  } else {
    headers = ["Mã KH", "Mã đơn", "Lần chăm", "Thời gian", "Nhân viên", "Kênh chăm sóc", "Kênh mua", "Mục đích", "Liên lạc", "Kết quả", "Lý do chưa mua", "Ngày hết liệu trình", "Lệch ngày", "Nhắc đúng lúc", "Hài lòng", "Phản ứng bất thường", "Ghi chú"];
    rows = data.activities.filter((item) => inRange(item.occurredAt) && (!owner || item.employee === owner)).map((item) => [item.customerId, item.orderId || "", item.careAttempt || "", item.occurredAt, item.employee, item.channel, item.purchaseChannel || "", item.purpose, item.contactStatus, item.result, item.noPurchaseReason || "", item.productEndDate || "", item.dueOffsetDays ?? "", item.repurchaseTimely === undefined ? "" : item.repurchaseTimely ? "Đúng" : "Sai", item.satisfaction || "", item.adverseReaction ? "Có" : "Không", item.note || ""]);
  }
  const file = await createExcelFile(name, headers, rows);
  return excelResponse(file, `${template}-${from || "all"}-${to || "all"}.xlsx`);
}
