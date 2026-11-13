import { NextRequest } from "next/server";
import { getReportData } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse, type ExcelCell } from "@/lib/excel";
import { hasPermission } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "reports")) return new Response("Không có quyền xuất báo cáo.", { status: 403 });
  const data = await getReportData(user), p = request.nextUrl.searchParams, from = p.get("from"), to = p.get("to"), owner = p.get("owner"), template = p.get("template") || "detail";
  const inRange = (value: string) => (!from || value.slice(0, 10) >= from) && (!to || value.slice(0, 10) <= to);
  let name = "Chi tiết chăm sóc", headers: string[], rows: ExcelCell[][];
  if (template === "employee") {
    name = "Hiệu quả nhân viên"; headers = ["Nhân viên", "Lượt chăm sóc", "Số khách", "Liên lạc được", "Mua lại / hẹn mua", "Phản ứng bất thường"];
    const items = data.activities.filter((item) => inRange(item.occurredAt) && (!owner || item.employee === owner));
    const employees = [...new Set(items.map((item) => item.employee))];
    rows = employees.map((employee) => { const own = items.filter((item) => item.employee === employee); return [employee, own.length, new Set(own.map((item) => item.customerId)).size, own.filter((item) => item.contactStatus === "Liên lạc được").length, own.filter((item) => item.result.includes("Mua lại") || item.result.includes("Hẹn mua")).length, own.filter((item) => item.adverseReaction).length]; });
  } else if (template === "customers") {
    name = "Tổng hợp khách hàng"; headers = ["Mã khách", "Khách hàng", "Số điện thoại", "Phụ trách", "Phân nhóm", "Số đơn", "Doanh thu", "Đơn gần nhất", "Lịch chăm sóc tiếp theo"];
    rows = data.customers.filter((item) => !owner || item.owner === owner).map((item) => [item.id, item.name, item.phone, item.owner, item.segment, item.orders, item.revenue, item.lastOrder, item.nextCare]);
  } else if (template === "tickets") {
    name = "Phiếu yêu cầu"; headers = ["Mã phiếu", "Ngày tạo", "Khách hàng", "Nội dung", "Ưu tiên", "Trạng thái", "Hướng xử lý", "Phụ trách", "Mã đơn", "Sản phẩm thu/đổi", "Sản phẩm đổi sang"];
    rows = data.tickets.filter((item) => inRange(item.createdAt) && (!owner || item.owner === owner)).map((item) => [item.id, item.createdAt, item.customer, item.title, item.priority, item.status, item.resolution || "", item.owner, item.orderCode || "", item.returnProductName || "", item.exchangeProductName || ""]);
  } else {
    headers = ["Mã KH", "Mã đơn", "Lần chăm", "Thời gian", "Nhân viên", "Kênh chăm sóc", "Kênh mua", "Mục đích", "Liên lạc", "Kết quả", "Lý do chưa mua", "Ngày hết liệu trình", "Lệch ngày", "Nhắc đúng lúc", "Hài lòng", "Phản ứng bất thường", "Ghi chú"];
    rows = data.activities.filter((item) => inRange(item.occurredAt) && (!owner || item.employee === owner)).map((item) => [item.customerId, item.orderId || "", item.careAttempt || "", item.occurredAt, item.employee, item.channel, item.purchaseChannel || "", item.purpose, item.contactStatus, item.result, item.noPurchaseReason || "", item.productEndDate || "", item.dueOffsetDays ?? "", item.repurchaseTimely === undefined ? "" : item.repurchaseTimely ? "Đúng" : "Sai", item.satisfaction || "", item.adverseReaction ? "Có" : "Không", item.note || ""]);
  }
  const file = await createExcelFile(name, headers, rows);
  return excelResponse(file, `${template}-${from || "all"}-${to || "all"}.xlsx`);
}
