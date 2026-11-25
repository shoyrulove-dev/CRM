import { reportDay, reportInRange } from "./report-filters";
import type { CareActivity, SalesOrder } from "./types";

export const customerReportViews = {
  "care-days": "Khách đã chăm theo ngày",
  "product-buyers": "Tần suất mua theo sản phẩm",
  "product-history": "Lịch sử mua theo khách",
  "sales-review": "Đối chiếu mua lại (tạm tính)",
  "sales-orders": "Chi tiết đơn đối chiếu",
} as const;
export type CustomerReportView = keyof typeof customerReportViews;
export function isCustomerReportView(value: string | null | undefined): value is CustomerReportView {
  return !!value && Object.hasOwn(customerReportViews, value);
}

export function countDailyCare(activities: CareActivity[]) {
  const days = new Map<string, { visits: number; customers: Set<string>; contacted: Set<string> }>();
  for (const activity of activities) {
    const day = reportDay(activity.occurredAt);
    if (!day) continue;
    const row = days.get(day) ?? { visits: 0, customers: new Set<string>(), contacted: new Set<string>() };
    row.visits++;
    if (activity.customerId) {
      row.customers.add(activity.customerId);
      if (activity.contactStatus === "Liên lạc được") row.contacted.add(activity.customerId);
    }
    days.set(day, row);
  }
  return [...days].sort(([a], [b]) => b.localeCompare(a))
    .map(([day, row]) => [day, row.customers.size, row.visits, row.contacted.size]);
}

function productCodes(order: SalesOrder) {
  return new Set((order.products ?? []).map(line => line.sku?.trim().toUpperCase()).filter(Boolean));
}

export function countProductPurchases(orders: SalesOrder[]) {
  const counts = new Map<string, { customerId: string; sku: string; product: string; orders: Set<string> }>();
  for (const order of orders) {
    if (order.status !== "Mua hàng" || !order.customerId) continue;
    for (const line of order.products ?? []) {
      const sku = line.sku?.trim().toUpperCase();
      if (!sku) continue;
      const key = JSON.stringify([order.customerId, sku]);
      const row = counts.get(key) ?? { customerId: order.customerId, sku, product: line.name, orders: new Set<string>() };
      row.orders.add(order.id || order.code);
      counts.set(key, row);
    }
  }
  return [...counts.values()].map(({ orders, ...row }) => ({ ...row, times: orders.size }));
}

export type PurchaseClass = "new" | "old" | "different" | "mixed" | "unknown";
export const purchaseLabels: Record<PurchaseClass, string> = {
  new: "Mua lần đầu trong dữ liệu CRM",
  old: "Chỉ mua sản phẩm cũ",
  different: "Chỉ mua sản phẩm mới",
  mixed: "Mua cả cũ lẫn mới",
  unknown: "Chưa đủ dữ liệu",
};

export type PurchaseBaseline = { day: string; code: string; skus: string[] };

export function classifyPurchases(orders: SalesOrder[], history = new Map<string, PurchaseBaseline>()) {
  const sorted = orders.filter(order => order.status === "Mua hàng").sort((a, b) =>
    a.orderDate.localeCompare(b.orderDate) || a.code.localeCompare(b.code, undefined, { numeric: true }) || a.id.localeCompare(b.id));
  const firstByCustomer = new Map<string, SalesOrder>();
  return sorted.map(order => {
    const first = firstByCustomer.get(order.customerId);
    const baseline = history.get(order.customerId);
    let kind: PurchaseClass = "unknown";
    if (!first && order.customerId) {
      firstByCustomer.set(order.customerId, order);
      if (order.purchaseType !== "Mua lại") kind = "new";
    } else if (first && first.purchaseType !== "Mua lại") {
      const firstCodes = productCodes(first), currentCodes = productCodes(order);
      if (firstCodes.size && currentCodes.size && first.products.every(line => line.sku?.trim()) && order.products.every(line => line.sku?.trim())) {
        const matched = [...currentCodes].filter(sku => firstCodes.has(sku)).length;
        kind = matched === 0 ? "different" : matched === currentCodes.size ? "old" : "mixed";
      }
    }
    const historical = Boolean(baseline && baseline.day < reportDay(order.orderDate));
    const useBaseline = historical && baseline && (!first || baseline.day <= reportDay(first.orderDate));
    if (useBaseline) {
      const codes = productCodes(order);
      kind = "unknown";
      if (baseline.skus.length && codes.size && order.products?.every(line => line.sku?.trim()) &&
          (!first || baseline.day !== reportDay(first.orderDate) || baseline.code === first.code)) {
        const matched = [...codes].filter(sku => baseline.skus.includes(sku)).length;
        kind = matched === 0 ? "different" : matched === codes.size ? "old" : "mixed";
      }
    }
    return { order, kind, firstCode: useBaseline ? baseline.code : first?.code || "", repeat: historical || Boolean(first) || order.purchaseType === "Mua lại", historical };
  });
}

export function periodKey(day: string, unit: string) {
  if (unit === "day") return day;
  if (unit === "year") return day.slice(0, 4);
  if (unit === "quarter") return `${day.slice(0, 4)}-Q${Math.ceil(Number(day.slice(5, 7)) / 3)}`;
  return day.slice(0, 7);
}

export function summarizePurchases(rows: ReturnType<typeof classifyPurchases>, from: string, to: string, owner: string, unit: string) {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const { order } = row;
    const employee = order.salesperson?.trim() || "Chưa xác định người bán";
    if (!reportInRange(order.orderDate, from, to) || (owner && employee !== owner)) continue;
    const period = periodKey(reportDay(order.orderDate), unit);
    for (const name of ["", employee]) {
      const key = JSON.stringify([period, name]);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, group]) => {
    const [period, employee] = JSON.parse(key) as [string, string];
    const buyers = new Set(group.map(row => row.order.customerId).filter(Boolean));
    const newBuyers = new Set(group.filter(row => row.kind === "new").map(row => row.order.customerId));
    const previousBuyers = new Set(group.filter(row => row.repeat && row.order.customerId).map(row => row.order.customerId));
    return [
      period, employee || (owner ? "Tổng theo bộ lọc" : "Tổng toàn đội"),
      group.length, group.reduce((sum, row) => sum + (Number(row.order.total) || 0), 0),
      buyers.size, newBuyers.size, buyers.size ? Math.round(newBuyers.size / buyers.size * 10000) / 100 : 0,
      previousBuyers.size, group.filter(row => row.kind === "old").length,
      group.filter(row => row.kind === "different").length, group.filter(row => row.kind === "mixed").length,
      group.filter(row => row.kind === "unknown").length,
      group.filter(row => row.repeat).reduce((sum, row) => sum + (Number(row.order.total) || 0), 0),
    ];
  });
}
