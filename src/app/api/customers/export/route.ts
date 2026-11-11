import { NextRequest } from "next/server";
import { listCustomers } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse, vietnamDateStamp } from "@/lib/excel";
import { hasPermission } from "@/lib/session";

const columns = {
  id: "Mã khách",
  name: "Tên khách",
  phone: "Số điện thoại",
  birthDate: "Ngày sinh",
  owner: "Nhân viên",
  segment: "Phân nhóm",
  healthGoal: "Mục tiêu sức khỏe",
  orders: "Số đơn",
  revenue: "Doanh thu",
  lastOrder: "Đơn gần nhất",
  nextCare: "Lịch chăm sóc",
} as const;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin" || !hasPermission(user, "customers"))
    return new Response("Chỉ quản trị viên được xuất dữ liệu tổng.", {
      status: 403,
    });
  const p = request.nextUrl.searchParams;
  const all = await listCustomers(p.get("q") || undefined, user);
  const customers = all.filter(
    (item) =>
      (!p.get("owner") || item.owner === p.get("owner")) &&
      (!p.get("status") || item.status === p.get("status")) &&
      (!p.get("from") || item.lastOrder >= String(p.get("from"))) &&
      (!p.get("to") || item.lastOrder <= String(p.get("to"))),
  );
  const requested = p
    .getAll("fields")
    .filter((key): key is keyof typeof columns => key in columns);
  const selected = requested.length
    ? requested
    : (Object.keys(columns) as (keyof typeof columns)[]);
  const file = await createExcelFile(
    "Khách hàng",
    selected.map((key) => columns[key]),
    customers.map((item) => selected.map((key) => item[key] ?? "")),
  );
  return excelResponse(file, `danh-sach-khach-hang-${vietnamDateStamp()}.xlsx`);
}
