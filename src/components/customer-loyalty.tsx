import type { Customer } from "@/lib/types";

export function CustomerLoyalty({ customer }: { customer: Customer }) {
  return <small className="customer-loyalty" title={customer.loyaltySyncedAt ? `Cập nhật từ Haravan: ${new Date(customer.loyaltySyncedAt).toLocaleString("vi-VN", { timeZone: "Asia/Bangkok" })}` : "API khách hàng Haravan hiện tại chưa trả về hạng thành viên và điểm thưởng."}>
    Hạng: {customer.membershipTier || "Chưa đồng bộ"} · Điểm: {typeof customer.loyaltyPoints === "number" ? customer.loyaltyPoints.toLocaleString("vi-VN") : "Chưa đồng bộ"}
  </small>;
}
