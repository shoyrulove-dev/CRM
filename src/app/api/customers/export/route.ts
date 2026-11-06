import { listCustomers } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse, vietnamDateStamp } from "@/lib/excel";
import { hasPermission } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers"))
    return new Response("Không có quyền xuất dữ liệu.", { status: 403 });
  const customers = await listCustomers(undefined, user);
  const headers = [
    "Mã khách",
    "Tên khách",
    "Số điện thoại",
    "Ngày sinh",
    "Nhân viên",
    "Phân nhóm",
    "Mục tiêu sức khỏe",
    "Số đơn",
    "Doanh thu",
    "Đơn gần nhất",
    "Lịch chăm sóc",
  ];
  const rows = customers.map((item) => [
    item.id,
    item.name,
    item.phone,
    item.birthDate || "",
    item.owner,
    item.segment,
    item.healthGoal,
    item.orders,
    item.revenue,
    item.lastOrder,
    item.nextCare,
  ]);
  const file = await createExcelFile("Khách hàng", headers, rows);
  return excelResponse(file, `danh-sach-khach-hang-${vietnamDateStamp()}.xlsx`);
}
