import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll } from "@/lib/session";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import { validDay } from "@/lib/month-range";
import { writeAudit } from "@/lib/audit";
import type { SalesOrder } from "@/lib/types";
import type { OrderReportAdjustment } from "@/lib/order-report-adjustment";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canSeeAll(user) || user.mustChangePassword) return fail("Chỉ quản trị viên được điều chỉnh đơn.", 403);
  if (!hasDatabase()) return fail("Kho dữ liệu chưa sẵn sàng.", 503);
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) return fail("Nhập lý do từ 3 đến 500 ký tự.");
  if (body.action !== "reset" && body.action !== "save") return fail("Thao tác không hợp lệ.");
  const { id } = await context.params;
  const orders = (await getDatabase()).collection<SalesOrder>(collections.orders);
  const order = await orders.findOne({ id });
  if (!order?.haravanId) return fail("Không tìm thấy đơn Haravan.", 404);
  const previous = order.reportAdjustment;
  if (body.expectedDate !== order.orderDate || body.expectedStatus !== order.status || body.expectedAt !== (previous?.at || ""))
    return fail("Đơn vừa thay đổi. Tải lại trang để đối soát lại.", 409);

  let adjustment: OrderReportAdjustment | null = null;
  if (body.action === "save") {
    if (typeof body.date !== "string" || !validDay(body.date) || !["Mua hàng", "Trả hàng", "Hủy"].includes(body.status) || typeof body.excluded !== "boolean")
      return fail("Ngày tính, trạng thái hoặc lựa chọn loại đơn không hợp lệ.");
    adjustment = { date: body.date, status: body.status, excluded: body.excluded, reason, editor: user.name,
      at: new Date().toISOString(), sourceDate: order.orderDate, sourceStatus: order.status };
  }
  const result = await orders.updateOne({
    _id: order._id, orderDate: order.orderDate, status: order.status,
    "reportAdjustment.at": previous?.at ?? { $exists: false },
  }, adjustment ? { $set: { reportAdjustment: adjustment } } : { $unset: { reportAdjustment: "" } });
  if (!result.matchedCount) return fail("Đơn vừa thay đổi. Tải lại trang để đối soát lại.", 409);
  await writeAudit(user, adjustment ? "correct" : "restore", "haravan_order_report", id, previous,
    { code: order.code, sourceDate: order.orderDate, sourceStatus: order.status, adjustment, reason });
  return NextResponse.json({ ok: true });
}
