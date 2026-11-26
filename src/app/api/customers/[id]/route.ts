import { NextRequest, NextResponse } from "next/server";
import { collections, getCustomerProfile } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll, hasPermission } from "@/lib/session";
import { cleanText, hasBrokenText } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { customerSegments, healthGoals, normalizeClassification } from "@/lib/customer-options";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers"))
    return NextResponse.json({ error: "Bạn không có quyền xem khách hàng." }, { status: 403 });
  const profile = await getCustomerProfile(id, user);
  if (!profile.customer)
    return NextResponse.json(
      { error: "Không tìm thấy khách hàng." },
      { status: 404 },
    );
  return NextResponse.json(profile);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." },
      { status: 503 },
    );
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (hasBrokenText([body?.name, body?.owner, body?.segment, body?.healthGoal]))
    return NextResponse.json({ error: "Nội dung có ký tự bị lỗi. Vui lòng nhập lại bằng tiếng Việt." }, { status: 400 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers"))
    return NextResponse.json({ error: "Bạn không có quyền sửa khách hàng." }, { status: 403 });
  const allowed = [
    "name",
    "phone",
    "segment",
    "healthGoal",
    "advisoryNote",
    "birthDate",
    "nextCare",
    "status",
    ...(canSeeAll(user) ? ["owner"] : []),
  ];
  const update = Object.fromEntries(
    Object.entries(body || {}).filter(([key]) => allowed.includes(key)),
  );
  if (!Object.keys(update).length)
    return NextResponse.json(
      { error: "Không có thông tin hợp lệ để cập nhật." },
      { status: 400 },
    );
  for (const field of ["segment", "healthGoal"])
    if (field in update) update[field] = normalizeClassification(cleanText(update[field], field === "segment" ? 80 : 120) || "Chưa xác định");
  const dbForValidation = await getDatabase();
  const existing = await dbForValidation.collection(collections.customers).findOne({ id, ...(canSeeAll(user) ? {} : { owner: user?.name }) });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
  if (existing.haravanId && ["name", "phone", "birthDate"].some(field => field in update && update[field] !== existing[field]))
    return NextResponse.json({ error: "Dùng mục Đối soát Haravan để điều chỉnh tên, SĐT hoặc ngày sinh.", status: 409 });
  if ("advisoryNote" in update) {
    if (typeof update.advisoryNote !== "string" || update.advisoryNote.length > 2000 || hasBrokenText(update.advisoryNote))
      return NextResponse.json({ error: "Lưu ý tư vấn không hợp lệ hoặc vượt 2.000 ký tự." }, { status: 400 });
    update.advisoryNote = update.advisoryNote.trim();
    if (update.advisoryNote === (existing.advisoryNote || "")) delete update.advisoryNote;
    else {
      update.advisoryNoteBy = user?.name;
      update.advisoryNoteAt = new Date().toISOString();
    }
  }
  if (!Object.keys(update).length) return NextResponse.json({ data: existing });
  if ("owner" in update) {
    update.owner = cleanText(update.owner, 120);
    if (update.owner !== "Chưa phân công" && !await dbForValidation.collection(collections.users).findOne({ name: update.owner, active: true, archivedAt: { $exists: false } }))
      return NextResponse.json({ error: "Nhân viên không tồn tại hoặc không còn hoạt động." }, { status: 400 });
  }
  for (const [field, options] of [["segment", customerSegments], ["healthGoal", healthGoals]] as const) {
    if (field in update && !options.includes(String(update[field])) && update[field] !== normalizeClassification(String(existing[field] || "")))
      return NextResponse.json({ error: "Vui lòng chọn phân nhóm và mục tiêu sức khỏe trong danh sách." }, { status: 400 });
  }
  const result = await (await getDatabase())
    .collection(collections.customers)
    .findOneAndUpdate(
      { id, ...(canSeeAll(user) ? {} : { owner: user?.name }) },
      { $set: { ...update, ...(update.owner ? { ownerSource: "manual" } : {}), updatedAt: new Date().toISOString() } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  if (result && update.owner) {
    const db = await getDatabase();
    await Promise.all([
      db.collection(collections.orders).updateMany(
        { customerId: id },
        { $set: { owner: update.owner } },
      ),
      db.collection(collections.careTasks).updateMany(
        { customerId: id, status: { $ne: "done" } },
        { $set: { owner: update.owner } },
      ),
      db.collection(collections.tickets).updateMany(
        { customerId: id, status: { $ne: "Đã đóng" } },
        { $set: { owner: update.owner } },
      ),
    ]);
  }
  if (result) await writeAudit(user, "update", "customer", id, existing, result);
  return result
    ? NextResponse.json({ data: result })
    : NextResponse.json(
        { error: "Không tìm thấy khách hàng." },
        { status: 404 },
      );
}
