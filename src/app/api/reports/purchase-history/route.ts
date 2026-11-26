import { createHash, randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { preview, normalizePhone, type HistoryCells } from "../../../../../scripts/preview-purchase-history.cjs";
import { getCurrentUser } from "@/lib/current-user";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections, getReportData } from "@/lib/data-store";
import { effectiveReportOrders } from "@/lib/order-report-adjustment";
import { validDay } from "@/lib/month-range";
import { classifyPurchases, purchaseLabels, type PurchaseBaseline } from "@/lib/customer-report-metrics";
import { loadPurchaseHistory, mergePurchaseBaseline, purchaseHistoryBatches, purchaseHistoryRows } from "@/lib/purchase-history";
import { writeAudit } from "@/lib/audit";

const maxBytes = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !["admin", "super_admin"].includes(user.role) || user.mustChangePassword)
    return fail("Chỉ Quản trị và Super Admin được nhập lịch sử mua.", 403);
  if (!hasDatabase()) return fail("Kho dữ liệu chưa sẵn sàng.", 503);
  const db = await getDatabase();
  const batches = db.collection(purchaseHistoryBatches);
  if (request.nextUrl.searchParams.get("action") === "approve") {
    const body = await request.json().catch(() => null);
    if (typeof body?.id !== "string") return fail("Thiếu mã lượt nhập.");
    await batches.createIndex({ digest: 1 }, { unique: true, partialFilterExpression: { status: "approved" } });
    const batch = await batches.findOneAndUpdate({ id: body.id, userId: user.id, status: "preview", expiresAt: { $gt: new Date() } },
      { $set: { status: "approved", approvedAt: new Date() } }, { returnDocument: "after" })
      .catch((error: unknown) => {
        if ((error as { code?: number }).code === 11000) return null;
        throw error;
      });
    if (!batch) {
      if (await batches.findOne({ id: body.id, userId: user.id, status: "approved" })) return NextResponse.json({ ok: true });
      return fail("Bản xem trước hết hạn, không còn hiệu lực hoặc tệp đã được áp dụng.", 409);
    }
    await writeAudit(user, "approve", "purchase_history", body.id, null, { filename: batch.filename, matched: batch.matched, cutoff: batch.cutoff });
    return NextResponse.json({ ok: true });
  }
  if (Number(request.headers.get("content-length")) > maxBytes + 65536) return fail("Tệp vượt 10 MB. Vui lòng chia theo tháng.", 413);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file"), cutoff = form?.get("cutoff");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || !file.size || file.size > maxBytes)
    return fail("Chọn tệp .xlsx tối đa 10 MB. Tệp lớn hơn cần chia theo tháng.");
  if (typeof cutoff !== "string" || !validDay(cutoff)) return fail("Mốc lịch sử không hợp lệ.");
  const rawEdits = form?.get("edits");
  const edits: Record<string, Partial<HistoryCells>> = {};
  if (rawEdits) {
    if (typeof rawEdits !== "string" || rawEdits.length > 50000) return fail("Danh sách ô sửa vượt giới hạn.");
    try {
      const parsed = JSON.parse(rawEdits);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object" || Object.keys(parsed).length > 100) throw new Error();
      for (const [row, fields] of Object.entries(parsed)) {
        if (!/^[1-9]\d{0,6}$/.test(row) || !fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error();
        const clean: Record<string, string> = {};
        for (const [field, value] of Object.entries(fields)) {
          if (!["date", "phone", "order", "sku"].includes(field) || typeof value !== "string" || value.length > 120) throw new Error();
          clean[field] = value.trim();
        }
        edits[row] = clean;
      }
    } catch {
      return fail("Ô chỉnh sửa không hợp lệ. Kiểm tra số dòng và độ dài nội dung.");
    }
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).update(cutoff).digest("hex");
  if (await batches.findOne({ digest, status: "approved" })) return fail("Tệp với mốc này đã được áp dụng.", 409);
  const byPhone = new Map<string, { day: string; orders: Map<string, Set<string>> }>();
  let validation;
  try {
    validation = await preview(Readable.from([bytes]), undefined, cutoff, row => {
      if (row.order.length > 120 || row.sku.length > 120) throw new Error("CELL_LIMIT");
      let first = byPhone.get(row.phone);
      if (!first || row.day < first.day) {
        first = { day: row.day, orders: new Map() };
        byPhone.set(row.phone, first);
      }
      if (row.day !== first.day) return;
      const codes = first.orders.get(row.order) || new Set<string>();
      codes.add(row.sku);
      first.orders.set(row.order, codes);
    }, 100_000, edits, true);
  } catch (error) {
    if ((error as Error).message === "ROW_LIMIT") return fail("Tệp vượt 100.000 dòng. Vui lòng chia theo tháng.");
    if ((error as Error).message === "CELL_LIMIT") return fail("Có mã đơn hoặc SKU dài hơn 120 ký tự. Kiểm tra hai cột này rồi tải lại.");
    if ((error as Error).message === "Missing purchase date or phone column.") return fail("Thiếu cột Ngày hạch toán (hoặc Ngày mua) hoặc SĐT. Đặt tên cột ở dòng tiêu đề của sheet đầu tiên.");
    if ((error as Error).message === "Selected worksheet has no header.") return fail("Sheet đầu tiên trống. Chuyển bảng dữ liệu vào sheet đầu tiên rồi tải lại.");
    return fail("Không đọc được tệp. Kiểm tra định dạng Excel và các cột Ngày hạch toán, SĐT.");
  }
  const match = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  for await (const customer of db.collection(collections.customers).find({}, { projection: { id: 1, phone: 1, name: 1 } })) {
    const phone = normalizePhone(customer.phone);
    if (!byPhone.has(phone) || !customer.id) continue;
    const ids = match.get(phone) || new Set<string>();
    ids.add(String(customer.id));
    names.set(String(customer.id), String(customer.name || ""));
    match.set(phone, ids);
  }
  let ambiguous = 0;
  const choices: { phone: string; customers: { id: string; name: string }[] }[] = [];
  let selected: Record<string, unknown> = {};
  try {
    const value = form?.get("matches");
    if (typeof value === "string" && value.length <= 30000) selected = JSON.parse(value) || {};
  } catch { return fail("Danh sách hồ sơ đã chọn không hợp lệ."); }
  const id = randomUUID();
  const records: (PurchaseBaseline & { batchId: string; customerId: string })[] = [];
  for (const [phone, ids] of match) {
    const chosen = selected[phone];
    if (ids.size !== 1) {
      if (choices.length < 20) choices.push({ phone, customers: [...ids].map(id => ({ id, name: names.get(id) || "" })) });
      if (typeof chosen !== "string" || !ids.has(chosen)) { ambiguous++; continue; }
    }
    const first = byPhone.get(phone)!;
    const [code, skus] = first.orders.entries().next().value!;
    const unambiguous = first.orders.size === 1 && Boolean(code);
    records.push({ batchId: id, customerId: ids.size === 1 ? [...ids][0] : chosen as string, day: first.day, code: unambiguous ? code : "",
      skus: unambiguous && !skus.has("") ? [...skus] : [] });
  }
  const data = await getReportData(user, { sections: ["orders"], purchaseReport: true });
  const orders = effectiveReportOrders(data.orders);
  const history = await loadPurchaseHistory(orders.map(order => order.customerId).filter(Boolean));
  const before = classifyPurchases(orders, history);
  for (const row of records) mergePurchaseBaseline(history, row.customerId, row);
  const after = classifyPurchases(orders, history);
  const beforeById = new Map(before.map(row => [row.order.id, row]));
  const changed = after.filter(row => {
    const old = beforeById.get(row.order.id);
    return old && (old.repeat !== row.repeat || old.kind !== row.kind);
  });
  const revenue = (rows: typeof after) => rows.reduce((sum, row) => sum + (row.repeat ? Number(row.order.total) || 0 : 0), 0);
  const result = {
    id, validation, choices, matched: records.length, ambiguous, unmatched: byPhone.size - match.size,
    changed: changed.length, beforeRevenue: revenue(before), afterRevenue: revenue(after),
    sample: changed.slice(0, 20).map(row => ({
      code: row.order.code, day: row.order.orderDate, employee: row.order.owner, amount: row.order.total,
      before: purchaseLabels[beforeById.get(row.order.id)!.kind], after: purchaseLabels[row.kind],
      beforeRepeat: beforeById.get(row.order.id)!.repeat, afterRepeat: row.repeat,
    })),
  };
  if (records.length) {
    for (let offset = 0; offset < records.length; offset += 500)
      await db.collection(purchaseHistoryRows).insertMany(records.slice(offset, offset + 500));
    await batches.insertOne({ id, digest, userId: user.id, filename: file.name.slice(0, 240), cutoff, matched: records.length,
      status: "preview", createdAt: new Date(), expiresAt: new Date(Date.now() + 3600_000) });
  }
  return NextResponse.json(result);
}

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
