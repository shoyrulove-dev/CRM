import type { Customer } from "@/lib/types";

export function CustomerLoyalty({ customer }: { customer: Customer }) {
  const expiry = customer.loyaltyExpiresAt
    ? ` · Hết hạn điểm: ${new Date(customer.loyaltyExpiresAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Bangkok" })}` : "";
  return <small className="customer-loyalty" title={customer.loyaltySyncedAt ? `Cập nhật từ Haravan V2: ${new Date(customer.loyaltySyncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}${expiry}` : "Chưa đồng bộ hạng và điểm từ API chi tiết khách hàng Haravan V2."}>
    Hạng: {customer.membershipTier || (customer.loyaltySyncedAt ? "Chưa có hạng" : "Chưa đồng bộ")} · Điểm: {typeof customer.loyaltyPoints === "number" ? customer.loyaltyPoints.toLocaleString("vi-VN") : "Chưa đồng bộ"}
  </small>;
}
