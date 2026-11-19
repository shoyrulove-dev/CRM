import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { collections } from "./data-store";
import { getDatabase } from "./mongodb";
import { writeAudit } from "./audit";
import type { SessionUser } from "./session";
import { careImportKey, foldImportText, normalizeImportPhone, parseCareWorkbook, type ParsedCareRow, type ImportActivity } from "./care-import-parser";

export type CareImportRow = ParsedCareRow & {
  status: "ready" | "warning" | "error" | "duplicate";
  customerId: string; customerName: string; customerOwner: string; employeeId: string; importKey: string;
};
type ImportBatch = {
  id: string; userId: string; fileName: string; fileHash: string; rows: CareImportRow[];
  createdAt: string; expiresAt: Date; status: string; lockUntil?: Date; lockOwner?: string;
};
const BATCHES = "care_import_batches";
export function isCareImportAdmin(user: SessionUser | null) {
  return !!user && ["admin", "super_admin"].includes(user.role);
}

export async function resolveCareImportRows(parsed: ParsedCareRow[]): Promise<CareImportRow[]> {
  const db = await getDatabase();
  const [customers, users] = await Promise.all([
    db.collection(collections.customers).find({}, { projection: { _id: 0, id: 1, name: 1, phone: 1, owner: 1 } }).toArray(),
    db.collection(collections.users).find({ active: true }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
  ]);
  const byPhone = new Map<string, typeof customers>();
  for (const customer of customers) {
    const phone = normalizeImportPhone(customer.phone);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) || []), customer]);
  }
  const rows: CareImportRow[] = parsed.map(row => {
    const errors = [...row.errors], warnings = [...row.warnings];
    const matches = row.phone ? byPhone.get(row.phone) || [] : [];
    const employees = users.filter(user => foldImportText(user.name) === foldImportText(row.data.employee));
    if (matches.length !== 1) errors.push(matches.length ? "SĐT khớp nhiều khách; cần quản trị xử lý trước." : "Không tìm thấy khách theo SĐT; không tự tạo khách mới.");
    if (employees.length !== 1) errors.push("Nhân viên không tồn tại, đã khóa hoặc trùng tên; cần xử lý trước.");
    const customer = matches.length === 1 ? matches[0] : undefined;
    const employee = employees.length === 1 ? employees[0] : undefined;
    if (customer && foldImportText(customer.name) !== foldImportText(row.name)) warnings.push("Tên trong Excel khác tên CRM; cần xác nhận đúng khách.");
    if (customer && foldImportText(customer.owner) !== foldImportText(row.data.employee)) warnings.push("Nhân viên chăm khác người phụ trách hiện tại; không chuyển người phụ trách.");
    const data = { ...row.data, employee: String(employee?.name || row.data.employee) };
    return { ...row, data, errors, warnings, status: errors.length ? "error" : warnings.length ? "warning" : "ready",
      customerId: String(customer?.id || ""), customerName: String(customer?.name || ""),
      customerOwner: String(customer?.owner || ""), employeeId: String(employee?.id || ""),
      importKey: customer ? careImportKey(String(customer.id), data) : "" };
  });
  const ids = [...new Set(rows.map(row => row.customerId).filter(Boolean))];
  const existing = ids.length ? await db.collection(collections.careActivities).find({ customerId: { $in: ids } }).toArray() : [];
  const keys = new Set(existing.map(activity => careImportKey(String(activity.customerId), activity as unknown as Partial<ImportActivity>)));
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.status === "error") continue;
    if (keys.has(row.importKey) || seen.has(row.importKey)) {
      row.status = "duplicate"; row.warnings.push("Đã có nhật ký tương tự cùng khách/ngày/nhân viên/nội dung hoặc trùng dòng trong file; bỏ qua.");
    }
    seen.add(row.importKey);
  }
  return rows;
}

export async function previewCareImport(buffer: Buffer, fileName: string, user: SessionUser) {
  if (!isCareImportAdmin(user)) throw new Error("Chỉ admin được nhập Excel.");
  const rows = await resolveCareImportRows(await parseCareWorkbook(buffer));
  const db = await getDatabase();
  await db.collection(BATCHES).createIndex({ id: 1 }, { unique: true });
  await db.collection(BATCHES).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const batch: ImportBatch = { id: randomUUID(), userId: user.id, fileName: fileName.slice(0, 180),
    fileHash: createHash("sha256").update(buffer).digest("hex"), rows,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60_000), status: "preview" };
  await db.collection<ImportBatch>(BATCHES).insertOne(batch);
  return { batchId: batch.id, expiresAt: batch.expiresAt.toISOString(), rows };
}

export async function commitCareImport(batchId: string, selected: number[], acknowledgeWarnings: boolean, user: SessionUser) {
  if (!isCareImportAdmin(user)) throw new Error("Chỉ admin được nhập Excel.");
  const db = await getDatabase(), batches = db.collection<ImportBatch>(BATCHES);
  const now = new Date();
  const batch = await batches.findOne({ id: batchId, userId: user.id, expiresAt: { $gt: now } });
  if (!batch) throw new Error("Bản xem trước không tồn tại hoặc đã hết hạn; hãy tải file lại.");
  const selectedRows = batch.rows.filter(row => selected.includes(row.row));
  if (!selectedRows.length || selectedRows.length !== new Set(selected).size ||
      selectedRows.some(row => !["ready", "warning"].includes(row.status)))
    throw new Error("Danh sách dòng xác nhận không hợp lệ.");
  const current = await resolveCareImportRows(selectedRows.map(row => ({ ...row,
    errors: row.errors, warnings: row.warnings })));
  if (current.some((row, index) => row.status === "error" || row.customerId !== selectedRows[index].customerId ||
      row.employeeId !== selectedRows[index].employeeId || row.customerName !== selectedRows[index].customerName ||
      row.customerOwner !== selectedRows[index].customerOwner))
    throw new Error("Hồ sơ khách/nhân viên đã thay đổi; hãy tải file lại để đối chiếu.");
  if (current.some(row => row.warnings.length && row.status !== "duplicate") && !acknowledgeWarnings)
    throw new Error("Cần xác nhận đã kiểm tra các dòng cảnh báo.");
  const lockOwner = randomUUID();
  const lock = await batches.findOneAndUpdate({ id: batchId, userId: user.id, expiresAt: { $gt: now }, $or: [
    { status: { $in: ["preview", "partial", "completed"] } },
    { status: "committing", lockUntil: { $lte: now } },
  ] }, { $set: { status: "committing", lockOwner, lockUntil: new Date(now.getTime() + 120_000) } }, { returnDocument: "after" });
  if (!lock) throw new Error("Đợt nhập đang được xử lý; vui lòng chờ trước khi thử lại.");
  let inserted = 0, skipped = 0;
  const results: Array<{ row: number; status: string; message: string }> = [];
  try {
    const activities = db.collection(collections.careActivities);
    await activities.createIndex({ importKey: 1 }, { unique: true, partialFilterExpression: { importKey: { $type: "string" } } });
    for (const row of current) {
      if (row.status === "duplicate") { skipped++; results.push({ row: row.row, status: "skipped", message: "Nhật ký tương tự đã tồn tại." }); continue; }
      const { dateOnly, ...data } = row.data;
      try {
        const result = await activities.updateOne({ importKey: row.importKey }, { $setOnInsert: {
          ...data, id: `NK-IMP-${row.importKey.slice(0, 24)}`, customerId: row.customerId,
          importKey: row.importKey, importBatchId: batch.id, source: "excel-import",
          sourceFileHash: batch.fileHash, sourceRow: row.row, sourceFileName: batch.fileName,
          sourceOriginal: row.original, occurredAtDateOnly: dateOnly,
          importedBy: user.id, createdAt: new Date().toISOString(),
        } }, { upsert: true });
        if (result.upsertedCount) { inserted++; results.push({ row: row.row, status: "inserted", message: "Đã thêm lịch sử chăm sóc." }); }
        else { skipped++; results.push({ row: row.row, status: "skipped", message: "Đã nhập trước đó; không tạo trùng." }); }
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
        skipped++; results.push({ row: row.row, status: "skipped", message: "Một lượt nhập khác đã lưu dòng này." });
      }
    }
    const result = { batchId, inserted, skipped, results };
    await writeAudit(user, "import", "care_activity_batch", batchId, null, { fileHash: batch.fileHash, inserted, skipped, rows: results });
    await batches.updateOne({ id: batchId, lockOwner }, { $set: { status: "completed", result }, $unset: { lockOwner: "", lockUntil: "" } });
    return result;
  } catch (error) {
    await batches.updateOne({ id: batchId, lockOwner }, { $set: { status: "partial" }, $unset: { lockOwner: "", lockUntil: "" } });
    throw error;
  }
}
