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
  reviewedAt?: string;
  reviewedBy?: string;
  channel?: string;
  owner?: string;
  shares?: { employee: string; percent: number }[];
  manualChannelApproved?: boolean;
};

export function isManualReportChannel(channel: string) {
  return ["shopee", "googleshop", "tiktok", "tiktokshop", "lazada"].includes(
    (channel || "").toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
}

export function orderReportBlockReason(order: SalesOrder) {
  if (order.reportAdjustment?.excluded) return "Đã loại khi đối soát";
  if (order.status === "Hủy") return "Đơn hủy";
  if (order.deliveryState === "returned") return "Chuyển hoàn";
  if (order.deliveryState === "not_shipped") return "Chưa giao hàng";
  if ((isManualReportChannel(order.channel) || isManualReportChannel(order.reportAdjustment?.channel || "")) &&
    order.reportAdjustment?.manualChannelApproved !== true) return "Chờ Admin duyệt kênh";
  return "";
}

export function reportSalesEligible(order: SalesOrder) {
  return !orderReportBlockReason(order);
}

export function effectiveReportOrder(order: SalesOrder): SalesOrder {
  const adjustment = order.reportAdjustment;
  return { ...order, orderDate: adjustment?.date ?? order.orderDate, status: adjustment?.status ?? order.status,
    owner: adjustment?.owner ?? order.owner, channel: adjustment?.channel ?? order.channel,
    total: Math.max(0, Number(order.total || 0) - Number(order.shippingFee || 0)) };
}

export function effectiveReportOrders(orders: SalesOrder[]) {
  return orders.filter(reportSalesEligible).map(effectiveReportOrder);
}

export function orderRevenueShares(order: SalesOrder) {
  return order.reportAdjustment?.shares?.length ? order.reportAdjustment.shares : [{ employee: order.owner, percent: 100 }];
}

export function creditedOrderRevenue(order: SalesOrder, employee?: string) {
  if (!employee) return order.total;
  return order.total * (orderRevenueShares(order).find(share => share.employee === employee)?.percent || 0) / 100;
}
