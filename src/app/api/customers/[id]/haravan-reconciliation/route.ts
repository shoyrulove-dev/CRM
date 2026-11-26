import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll } from "@/lib/session";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import { hasBrokenText } from "@/lib/validation";
import { validDay } from "@/lib/month-range";
import { writeAudit } from "@/lib/audit";
import { haravanCustomerFields, normalizeContactPhone, type HaravanCustomerField } from "@/lib/haravan-customer-reconciliation";
import type { Customer } from "@/lib/types";

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !canSeeAll(user) || user.mustChangePassword) return fail("Chỉ quản trị viên được điều chỉnh dữ liệu Haravan.", 403);
  if (!hasDatabase()) return fail("Kho dữ liệu chưa sẵn sàng.", 503);
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.field !== "string" || !Object.hasOwn(haravanCustomerFields, body.field))
    return fail("Chọn trường cần đối soát.");
  const field = body.field as HaravanCustomerField;
  const reset = body.action === "reset";
  if (!reset && body.action !== "save") return fail("Thao tác không hợp lệ.");
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const value = typeof body.value === "string" ? body.value.trim() : "";
  if (reason.length < 3 || reason.length > 500 || hasBrokenText(reason)) return fail("Nhập lý do hợp lệ từ 3 đến 500 ký tự.");
  if (!reset && (typeof body.value !== "string" || value.length > 120 || hasBrokenText(value))) return fail("Giá trị điều chỉnh không hợp lệ.");
  if (!reset && field === "name" && !value) return fail("Tên hiển thị không được để trống.");
  if (!reset && field === "birthDate" && value && (!validDay(value) || value > new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)))
    return fail("Ngày sinh phải là ngày hợp lệ và không nằm trong tương lai.");
  const db = await getDatabase();
  const customers = db.collection<Customer>(collections.customers);
  const before = await customers.findOne({ id });
  if (!before?.haravanId) return fail("Không tìm thấy hồ sơ đã liên kết Haravan.", 404);
  if (!before.haravanSource) return fail("Chưa có bản gốc để đối soát. Thử lại sau khi hồ sơ được đồng bộ.", 409);
  const sourceValue = before.haravanSource[field];
  if (body.expectedSource !== sourceValue || body.expectedEditedAt !== (before.haravanCorrections?.[field]?.editedAt || ""))
    return fail("Dữ liệu đã thay đổi từ lúc mở màn hình. Tải lại trang rồi đối soát lại.", 409);
  const storedField = field === "phone" ? "contactPhone" : field;
  const overridePath = `haravanCorrections.${field}`;
  if (reset && !before.haravanCorrections?.[field]) return fail("Trường này đang dùng dữ liệu nguồn.", 409);
  const phone = field === "phone" && !reset ? normalizeContactPhone(value) : "";
  if (field === "phone" && !reset) {
    if (!/^0[35789]\d{8}$/.test(phone)) return fail("Nhập SĐT di động Việt Nam hợp lệ.");
    const suffix = phone.slice(1).split("").join("\\D*");
    const equivalent = new RegExp(`^\\s*(?:0|\\+?84)[\\s.()-]*${suffix}\\D*$`);
    if (await customers.findOne({ id: { $ne: id }, $or: [{ phone: equivalent }, { contactPhone: phone }] }, { projection: { _id: 1 } }))
      return fail("SĐT đã được dùng ở hồ sơ khác. Kiểm tra lại trước khi lưu.", 409);
  }
  const corrected = field === "phone" ? phone : value;
  const at = new Date().toISOString();
  const result = await customers.updateOne(
    { _id: before._id, [`haravanSource.${field}`]: sourceValue, [overridePath]: before.haravanCorrections?.[field] ?? { $exists: false } },
    reset
      ? { $set: { updatedAt: at, ...(field === "phone" ? {} : { [storedField]: sourceValue }) },
          $unset: { [overridePath]: "", ...(field === "phone" ? { contactPhone: "" } : {}) } }
      : { $set: { updatedAt: at, [storedField]: corrected,
          [overridePath]: { value: corrected, sourceAtEdit: sourceValue, reason, editor: user.name, editedAt: at } } },
  );
  if (!result.matchedCount) return fail("Hồ sơ vừa thay đổi. Tải lại trang rồi đối soát lại.", 409);
  await writeAudit(user, reset ? "restore" : "correct", "haravan_customer", id,
    { field, source: sourceValue, effective: before[storedField] ?? sourceValue },
    { field, source: sourceValue, effective: reset ? sourceValue : corrected, reason });
  return NextResponse.json({ ok: true });
}
