import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll, hasPermission } from "@/lib/session";
import { cleanText } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

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
  const user = await getCurrentUser();
  if (!hasPermission(user, "tickets"))
    return NextResponse.json({ error: "Bạn không có quyền sửa phiếu." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const db = await getDatabase();
  const scope = { id, ...(canSeeAll(user) ? {} : { owner: user?.name }) };
  const before = await db.collection(collections.tickets).findOne(scope, { projection: { _id: 0 } });
  if (!before)
    return NextResponse.json({ error: "Không tìm thấy phiếu hoặc phiếu không thuộc phạm vi của bạn." }, { status: 404 });
  if (before.status === "Đã đóng" && user?.role !== "super_admin")
    return NextResponse.json({ error: "Phiếu đã đóng và không thể chỉnh sửa." }, { status: 409 });
  if (body?.note) {
    const content = cleanText(body.note, 1000);
    if (!content) return NextResponse.json({ error: "Nội dung cập nhật không được để trống." }, { status: 400 });
    const entry = { id: `CN-${Date.now()}`, content, author: user?.name || "Hệ thống", createdAt: new Date().toISOString() };
    await db.collection<{ updates?: typeof entry[]; updatedAt?: string }>(collections.tickets).updateOne(scope, { $push: { updates: entry }, $set: { updatedAt: entry.createdAt } });
    await writeAudit(user, "update", "ticket", id, before, { note: entry });
    return NextResponse.json({ data: entry });
  }
  const allowed = [
    "status",
    "owner",
    "priority",
    "title",
    "description",
    "customer",
    "resolution",
  ];
  const update = Object.fromEntries(
    Object.entries(body || {}).filter(([key]) => allowed.includes(key)),
  );
  if (!Object.keys(update).length)
    return NextResponse.json(
      { error: "Không có dữ liệu hợp lệ." },
      { status: 400 },
    );
  if (update.status === "Đã đóng" && !(update.resolution || before.resolution))
    return NextResponse.json({ error: "Vui lòng chọn hướng xử lý trước khi đóng phiếu." }, { status: 400 });
  if (before.status === "Đã đóng" && update.status !== "Mới")
    return NextResponse.json({ error: "Super Admin chỉ có thể mở lại phiếu về trạng thái Mới." }, { status: 400 });
  const now = new Date().toISOString();
  const result = await db
    .collection(collections.tickets)
    .findOneAndUpdate(
      scope,
      {
        $set: {
          ...update,
          updatedAt: now,
          ...(update.status === "Đã đóng" ? { closedAt: now } : {}),
        },
        ...(update.status && update.status !== "Đã đóng"
          ? { $unset: { closedAt: "" } }
          : {}),
      },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  await writeAudit(user, "update", "ticket", id, before, result);
  return result
    ? NextResponse.json({ data: result })
    : NextResponse.json({ error: "Không tìm thấy phiếu." }, { status: 404 });
}

export async function DELETE(
  _: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!hasPermission(user, "tickets"))
    return NextResponse.json({ error: "Bạn không có quyền xóa phiếu." }, { status: 403 });
  if (!canSeeAll(user))
    return NextResponse.json({ error: "Chỉ quản trị viên được xóa phiếu." }, { status: 403 });
  const result = await (await getDatabase())
    .collection(collections.tickets)
    .deleteOne({
      id,
    });
  return result.deletedCount
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { error: "Không tìm thấy phiếu hoặc bạn không được xóa." },
        { status: 404 },
      );
}
