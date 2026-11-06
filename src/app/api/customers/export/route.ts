import { listCustomers } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";

const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET() {
  const customers = await listCustomers(undefined,await getCurrentUser());
  const rows = [["Mã khách", "Tên khách", "Số điện thoại", "Nhân viên", "Phân nhóm", "Mục tiêu sức khỏe", "Số đơn", "Doanh thu", "Đơn gần nhất", "Lịch chăm sóc"]];
  customers.forEach(item => rows.push([item.id, item.name, item.phone, item.owner, item.segment, item.healthGoal, String(item.orders), String(item.revenue), item.lastOrder, item.nextCare]));
  const csv = "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="danh-sach-khach-hang-${new Date().toISOString().slice(0,10)}.csv"` } });
}
