import { NextRequest } from "next/server";
import { listCustomers, listTickets } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse } from "@/lib/excel";
import { hasPermission } from "@/lib/session";
import { monthBounds, dayBounds } from "@/lib/month-range";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "tickets")) return new Response("Không có quyền xuất phiếu.", { status: 403 });
  const [tickets, customers] = await Promise.all([listTickets(user), listCustomers(undefined, user)]);
  const p = request.nextUrl.searchParams, phone = new Map(customers.map((item) => [item.id, item.phone]));
  const bounds = dayBounds(p.get("date") || undefined) || monthBounds(p.get("from") || undefined, p.get("to") || undefined);
  const needle = (p.get("q") || "").trim().toLocaleLowerCase("vi");
  const rows = tickets.filter((item) =>
    (!p.get("status") || item.status === p.get("status")) && (!p.get("owner") || item.owner === p.get("owner")) &&
    (!p.get("resolution") || item.resolution === p.get("resolution")) && (!bounds.$gte || item.createdAt >= bounds.$gte) && (!bounds.$lte || item.createdAt <= bounds.$lte) && (!needle || `${item.id} ${item.customer} ${item.title} ${phone.get(item.customerId) || ""}`.toLocaleLowerCase("vi").includes(needle))
  ).map((item) => [item.id, item.createdAt, item.customer, phone.get(item.customerId) || "", item.title, item.description, item.priority, item.status, item.resolution || "", item.owner, item.orderCode || "", item.returnProductName || "", item.returnQuantity || "", item.exchangeProductName || "", item.exchangeQuantity || ""]);
  const file = await createExcelFile("Phiếu yêu cầu", ["Mã phiếu", "Ngày tạo", "Khách hàng", "Số điện thoại", "Nội dung", "Mô tả", "Ưu tiên", "Trạng thái", "Hướng xử lý", "Phụ trách", "Mã đơn", "Sản phẩm thu/đổi", "SL thu/đổi", "Sản phẩm đổi sang", "SL đổi"], rows);
  return excelResponse(file, `phieu-yeu-cau-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
