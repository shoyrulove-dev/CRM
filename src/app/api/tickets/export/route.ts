import { NextRequest } from "next/server";
import { listCustomers, listTickets } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse } from "@/lib/excel";
import { hasPermission } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "tickets")) return new Response("Không có quyền xuất phiếu.", { status: 403 });
  const [tickets, customers] = await Promise.all([listTickets(user), listCustomers(undefined, user)]);
  const p = request.nextUrl.searchParams, phone = new Map(customers.map((item) => [item.id, item.phone]));
  const rows = tickets.filter((item) =>
    (!p.get("status") || item.status === p.get("status")) && (!p.get("owner") || item.owner === p.get("owner")) &&
    (!p.get("resolution") || item.resolution === p.get("resolution")) && (!p.get("from") || item.createdAt.slice(0, 7) >= p.get("from")!) && (!p.get("to") || item.createdAt.slice(0, 7) <= p.get("to")!)
  ).map((item) => [item.id, item.createdAt, item.customer, phone.get(item.customerId) || "", item.title, item.description, item.priority, item.status, item.resolution || "", item.owner, item.orderCode || "", item.returnProductName || "", item.returnQuantity || "", item.exchangeProductName || "", item.exchangeQuantity || ""]);
  const file = await createExcelFile("Phiếu yêu cầu", ["Mã phiếu", "Ngày tạo", "Khách hàng", "Số điện thoại", "Nội dung", "Mô tả", "Ưu tiên", "Trạng thái", "Hướng xử lý", "Phụ trách", "Mã đơn", "Sản phẩm thu/đổi", "SL thu/đổi", "Sản phẩm đổi sang", "SL đổi"], rows);
  return excelResponse(file, `phieu-yeu-cau-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
