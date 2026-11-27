import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll } from "@/lib/session";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, validateImportArchive } from "@/lib/care-import-parser";
import { effectiveReportOrder, isManualReportChannel, orderReportBlockReason } from "@/lib/order-report-adjustment";
import { writeAudit } from "@/lib/audit";
import type { SalesOrder } from "@/lib/types";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const snapshot = (order: SalesOrder) => createHash("sha256").update(JSON.stringify([
  order.orderDate, order.status, order.owner, order.channel, order.total, order.shippingFee,
  order.deliveryState, order.reportAdjustment?.at, order.reportAdjustment?.reviewedAt,
])).digest("hex");

function reviewOrder(order: SalesOrder) {
  const effective = effectiveReportOrder(order);
  const approved = order.reportAdjustment?.manualChannelApproved === true;
  const reason = orderReportBlockReason({
    ...order, reportAdjustment: { ...order.reportAdjustment!, manualChannelApproved: true },
  });
  const issue = reason || (effective.status !== "Mua hàng" ? effective.status : "") ||
    (approved ? "Đã duyệt trước đó" : "") ||
    (order.shippingFee == null ? "Chưa đồng bộ phí vận chuyển" : "") ||
    (!order.deliveryState ? "Chưa đồng bộ trạng thái giao hàng" : "");
  return { id: order.id, code: order.code, channel: effective.channel, owner: effective.owner,
    date: effective.orderDate, net: effective.total, issue, revision: snapshot(order) };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !canSeeAll(user) || user.mustChangePassword) return fail("Chỉ quản trị viên được nhập đơn sàn.", 403);
  if (!hasDatabase()) return fail("Kho dữ liệu chưa sẵn sàng.", 503);
  const db = await getDatabase();
  const orders = db.collection<SalesOrder>(collections.orders);
  const employees = (await db.collection(collections.users).distinct("name", { active: true, archivedAt: { $exists: false } })).sort();

  if (request.headers.get("content-type")?.startsWith("application/json")) {
    const body = await request.json().catch(() => null);
    const entries = body?.entries;
    if (!Array.isArray(entries) || !entries.length || entries.length > MAX_IMPORT_ROWS ||
      entries.some(row => typeof row?.id !== "string" || typeof row.owner !== "string" ||
        !employees.includes(row.owner) || !["Shopee", "Google Shop", "TikTok Shop", "Lazada"].includes(row.channel) ||
        typeof row.revision !== "string")) return fail("Chọn kênh sàn và nhân viên đang hoạt động cho từng đơn.");
    const results = [];
    for (const entry of entries) {
      const order = await orders.findOne({ id: entry.id, haravanId: { $type: "string", $ne: "" } });
      if (!order || snapshot(order) !== entry.revision || reviewOrder(order).issue ||
        (order.reportAdjustment?.shares?.length && effectiveReportOrder(order).owner !== entry.owner)) {
        results.push({ id: entry.id, error: "Đơn đã thay đổi hoặc có tỷ lệ chia cần chỉnh ở Đối soát. Vui lòng xem lại." });
        continue;
      }
      const previous = order.reportAdjustment;
      const adjustment = { ...previous, date: previous?.date ?? order.orderDate, status: previous?.status ?? order.status,
        excluded: previous?.excluded ?? false, owner: entry.owner, channel: entry.channel, manualChannelApproved: true,
        reason: "Admin duyệt đơn sàn từ Excel", editor: user.name, at: new Date().toISOString(),
        sourceDate: previous?.sourceDate ?? order.orderDate, sourceStatus: previous?.sourceStatus ?? order.status };
      const saved = await orders.updateOne({ _id: order._id, orderDate: order.orderDate, status: order.status,
        owner: order.owner, channel: order.channel, total: order.total, shippingFee: order.shippingFee,
        deliveryState: order.deliveryState, "reportAdjustment.at": previous?.at ?? { $exists: false },
        "reportAdjustment.reviewedAt": previous?.reviewedAt ?? { $exists: false },
      }, { $set: { reportAdjustment: adjustment } });
      if (saved.modifiedCount) await writeAudit(user, "approve", "haravan_order_report", order.id, previous, { code: order.code, adjustment });
      results.push({ id: entry.id, error: saved.modifiedCount ? "" : "Đơn vừa thay đổi. Vui lòng xem trước lại." });
    }
    return NextResponse.json({ results });
  }

  if (Number(request.headers.get("content-length")) > MAX_IMPORT_BYTES + 65536) return fail("Tệp vượt 2 MB.", 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || !file.size || file.size > MAX_IMPORT_BYTES)
    return fail("Chọn tệp .xlsx tối đa 2 MB.");
  const workbook = new ExcelJS.Workbook();
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    validateImportArchive(buffer);
    await workbook.xlsx.read(Readable.from([buffer]));
  } catch {
    return fail("Không đọc được tệp Excel. Vui lòng kiểm tra lại định dạng.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount > MAX_IMPORT_ROWS + 1) return fail("Tệp cần có một bảng tối đa 500 dòng dữ liệu.");
  const codes = new Set<string>();
  let column = 0;
  sheet.getRow(1).eachCell((cell, number) => {
    if (["mã đơn hàng", "mã đơn", "mã"].includes(cell.text.trim().toLowerCase())) column ||= number;
  });
  if (!column) return fail("Thiếu cột Mã đơn hàng ở dòng tiêu đề.");
  for (let index = 2; index <= sheet.rowCount; index++) {
    const cell = sheet.getCell(index, column);
    if (cell.type === ExcelJS.ValueType.Formula) return fail(`Dòng ${index} dùng công thức làm mã đơn. Hãy dán giá trị trước khi tải lên.`);
    const code = cell.text.trim();
    if (code.length > 100) return fail(`Mã đơn ở dòng ${index} vượt 100 ký tự.`);
    if (code) codes.add(code);
  }
  if (!codes.size) return fail("Tệp chưa có mã đơn để đối chiếu.");
  const matched = await orders.find({ code: { $in: [...codes] }, haravanId: { $type: "string", $ne: "" } }).toArray();
  const byCode = new Map<string, SalesOrder[]>();
  for (const order of matched) byCode.set(order.code, [...(byCode.get(order.code) || []), order]);
  return NextResponse.json({ employees, rows: [...codes].map(code => {
    const candidates = byCode.get(code) || [];
    if (candidates.length !== 1) return { code, issue: candidates.length ? "Trùng mã trong CRM" : "Chưa có đơn trong CRM. Đồng bộ Haravan rồi thử lại." };
    const row = reviewOrder(candidates[0]);
    return { ...row, marketplace: isManualReportChannel(row.channel) };
  }) });
}
