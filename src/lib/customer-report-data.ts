import "server-only";
import { effectiveReportOrders, orderRevenueShares } from "./order-report-adjustment";
import { loadPurchaseHistory } from "./purchase-history";
import { getReportData } from "./data-store";
import { canSeeAll, type SessionUser } from "./session";
import { reportDay, reportInRange } from "./report-filters";
import {
  classifyPurchases, countDailyCare, countProductPurchases, purchaseLabels, summarizePurchases,
  type CustomerReportView,
} from "./customer-report-metrics";

export const reviewPeriods = { day: "Ngày", month: "Tháng", quarter: "Quý", year: "Năm" } as const;
export type CustomerReportFilters = {
  from: string; to: string; owner: string; customer: string; product: string; unit: string; channel?: string;
};

export async function getCustomerReport(view: CustomerReportView, filters: CustomerReportFilters, user: SessionUser) {
  const { from, to, customer, product, unit, channel } = filters;
  const owner = canSeeAll(user) ? filters.owner : user.name;
  const inRange = (value: string) => reportInRange(value, from, to);
  if (view === "care-days") {
    const { activities } = await getReportData(user, { summary: true, sections: ["activities"] });
    const selected = activities.filter(item => inRange(item.occurredAt) && (!owner || item.employee === owner));
    return {
      headers: ["Ngày chăm sóc", "Khách đã chăm", "Lượt chăm sóc", "Khách liên lạc được"],
      rows: countDailyCare(selected),
      employees: [...new Set(activities.map(item => item.employee).filter(Boolean))].sort(),
      channels: [],
    };
  }

  const { orders: sourceOrders, customers } = await getReportData(user, {
    sections: ["orders", "customers"], purchaseReport: true,
  });
  const orders = effectiveReportOrders(sourceOrders);
  const channels = [...new Set([...orders.map(order => order.channel), channel || ""].filter(Boolean))].sort();
  const channelMatches = (order: { channel: string }) => !channel || order.channel === channel;
  const names = new Map(customers.map(item => [item.id, item.name]));
  if (view === "sales-review" || view === "sales-orders") {
    const classified = classifyPurchases(orders, await loadPurchaseHistory(orders.map(order => order.customerId).filter(Boolean)))
      .filter(({ order }) => channelMatches(order));
    const employees = [...new Set(orders.flatMap(item => [item.owner?.trim() || "Chưa phân công", ...orderRevenueShares(item).map(share => share.employee)]).filter(Boolean))].sort();
    if (view === "sales-review") return {
      headers: ["Kỳ", "Phụ trách CRM", "Đơn mua", "Doanh số", "Khách mua", "Khách mua lần đầu", "Tỷ lệ khách mua lần đầu (%)", "Khách mua lại", "Đơn chỉ mua SP cũ", "Đơn chỉ mua SP mới", "Đơn mua cả cũ lẫn mới", "Đơn chưa đủ dữ liệu", "Doanh thu mua lại"],
      rows: summarizePurchases(classified, from, to, owner, unit), employees, channels,
    };
    return {
      headers: ["Ngày", "Mã đơn", "Kênh", "Mã khách", "Khách hàng", "Phụ trách CRM", "Người bán Haravan", "Doanh số", "Phân loại trên đơn", "Phân loại đối chiếu", "Mã đơn đầu đối chiếu", "Kết quả đối chiếu"],
      rows: classified.filter(({ order }) => inRange(order.orderDate) && (!owner || (order.owner?.trim() || "Chưa phân công") === owner))
        .map(({ order, kind, firstCode, repeat, historical }) => [reportDay(order.orderDate), order.code, order.channel || "Chưa rõ", order.customerId, names.get(order.customerId) || "", order.owner?.trim() || "Chưa phân công", order.salesperson || "", order.total, order.purchaseType === "Mua mới" ? "Tạm xếp mua mới" : order.purchaseType, purchaseLabels[kind], firstCode,
          !order.customerId ? "Thiếu mã khách" : historical ? "Có lịch sử mua đã duyệt" : repeat && order.purchaseType !== "Mua lại" ? "Có đơn trước trong CRM"
            : kind === "unknown" ? "Thiếu dữ liệu đơn đầu hoặc SKU" : kind === "new" ? "Cần lịch sử mua cũ để xác nhận" : "Khớp nhóm mua lại"]),
      employees, channels,
    };
  }

  const needle = product.toLocaleLowerCase("vi");
  const customerNeedle = customer.toLocaleLowerCase("vi");
  const employees = [...new Set(orders.map(item => item.owner).filter(Boolean))].sort();
  const pairs = countProductPurchases(orders.filter(item => inRange(item.orderDate) && (!owner || item.owner === owner) && channelMatches(item)))
    .filter(row => (!needle || `${row.sku} ${row.product || ""}`.toLocaleLowerCase("vi").includes(needle)) &&
      (!customerNeedle || `${row.customerId} ${names.get(row.customerId) || ""}`.toLocaleLowerCase("vi").includes(customerNeedle)));
  if (view === "product-history") return {
    headers: ["Mã khách", "Khách hàng", "SKU", "Sản phẩm", "Số lần mua"],
    rows: pairs.sort((a, b) => (names.get(a.customerId) || a.customerId).localeCompare(names.get(b.customerId) || b.customerId, "vi") || a.sku.localeCompare(b.sku))
      .map(row => [row.customerId, names.get(row.customerId) || "", row.sku, row.product || row.sku, row.times]),
    employees, channels,
  };
  const distribution = new Map<string, { sku: string; product: string; times: number; customers: number }>();
  for (const row of pairs) {
    const key = JSON.stringify([row.sku, row.times]);
    const bucket = distribution.get(key) ?? { sku: row.sku, product: row.product, times: row.times, customers: 0 };
    bucket.customers++;
    distribution.set(key, bucket);
  }
  return {
    headers: ["SKU", "Sản phẩm", "Số lần mua", "Số khách"],
    rows: [...distribution.values()].sort((a, b) => (a.product || a.sku).localeCompare(b.product || b.sku, "vi") || a.sku.localeCompare(b.sku) || a.times - b.times)
      .map(row => [row.sku, row.product || row.sku, row.times, row.customers]),
    employees, channels,
  };
}
