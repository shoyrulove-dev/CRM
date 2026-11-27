import type { SalesOrder } from "./types";

export type HaravanFulfillmentState = {
  shipment_status?: string | null;
  status?: string | null;
  carrier_status_code?: string | null;
  carrier_status_name?: string | null;
};

export function haravanShippingFee(lines?: { price?: number | string }[] | null) {
  if (!Array.isArray(lines)) return undefined;
  const amounts = lines.map(line => line.price === "" || line.price == null ? NaN : Number(line.price));
  return amounts.every(amount => Number.isFinite(amount) && amount >= 0)
    ? amounts.reduce((sum, amount) => sum + amount, 0) : undefined;
}

export function haravanDeliveryState(
  fulfillmentStatus: string | null | undefined,
  fulfillments?: HaravanFulfillmentState[],
): SalesOrder["deliveryState"] {
  const states = (fulfillments ?? []).filter(row => row.status !== "cancelled")
    .flatMap(row => [row.carrier_status_code, row.carrier_status_name, row.shipment_status].map(value => String(value || "").trim().toLowerCase()));
  if (states.some(state => ["return", "returned", "return_to_sender", "returning", "chuyển hoàn"].includes(state))) return "returned";
  if (states.some(state => ["delivered", "đã giao"].includes(state))) return "delivered";
  if (states.some(state => ["in_transit", "out_for_delivery", "đang giao hàng"].includes(state))) return "in_transit";
  if (states.some(state => ["readytopick", "ready_for_pickup", "chờ lấy hàng"].includes(state))) return "ready";
  if ((fulfillmentStatus === null || fulfillmentStatus === "unshipped" || fulfillmentStatus === "notfulfilled") && !states.some(Boolean)) return "not_shipped";
  return "unknown";
}
