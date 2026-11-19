import { reportInRange } from "./report-filters";
type Order = { customerId: string; orderDate: string; status: string; purchaseType: string; total: number };
export function retentionMetrics(all: Order[], from: string, to: string) {
  const purchased = all.filter(o => o.status === "Mua hàng");
  const period = purchased.filter(o => reportInRange(o.orderDate, from, to));
  const buyers = new Set(period.map(o => o.customerId));
  const repeatBuyers = new Set(period.filter(o => o.purchaseType === "Mua lại").map(o => o.customerId));
  const cumulative = new Map<string, number>();
  purchased.filter(o => reportInRange(o.orderDate, undefined, to)).forEach(o => cumulative.set(o.customerId, (cumulative.get(o.customerId) || 0) + 1));
  return { customersWithOrders: buyers.size, multiBuyers: repeatBuyers.size,
    repurchaseRate: buyers.size ? repeatBuyers.size / buyers.size : 0,
    repurchaseRevenue: period.filter(o => o.purchaseType === "Mua lại").reduce((sum, o) => sum + o.total, 0),
    cumulativeBuyers: cumulative.size, cumulativeRepeat: [...cumulative.values()].filter(n => n >= 2).length };
}
