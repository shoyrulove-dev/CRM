import type { SalesOrder } from "./types";

export type OrderReportAdjustment = {
  date: string;
  status: SalesOrder["status"];
  excluded: boolean;
  reason: string;
  editor: string;
  at: string;
  sourceDate: string;
  sourceStatus: SalesOrder["status"];
};

export function effectiveReportOrder(order: SalesOrder): SalesOrder {
  const adjustment = order.reportAdjustment;
  return adjustment ? { ...order, orderDate: adjustment.date, status: adjustment.status } : order;
}

export function effectiveReportOrders(orders: SalesOrder[]) {
  return orders.filter(order => !order.reportAdjustment?.excluded).map(effectiveReportOrder);
}
