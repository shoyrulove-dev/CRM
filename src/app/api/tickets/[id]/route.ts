import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll, hasPermission } from "@/lib/session";
import { cleanText, hasBrokenText, oneOf } from "@/lib/validation";
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
  if (hasBrokenText([body?.title, body?.description, body?.note, body?.owner, body?.resolution, body?.status]))
    return NextResponse.json({ error: "Nội dung có ký tự bị lỗi. Vui lòng nhập lại bằng tiếng Việt." }, { status: 400 });
  const db = await getDatabase();
  const scope = { id, ...(canSeeAll(user) ? {} : { owner: user?.name }) };
  const before = await db.collection(collections.tickets).findOne(scope, { projection: { _id: 0 } });
  if (!before)
    return NextResponse.json({ error: "Không tìm thấy phiếu hoặc phiếu không thuộc phạm vi của bạn." }, { status: 404 });
  if (before.status === "Đã đóng")
    return NextResponse.json({ error: "Phiếu đã đóng và không thể chỉnh sửa." }, { status: 409 });
  if (body?.owner && !canSeeAll(user) && body.owner !== user?.name)
    return NextResponse.json({ error: "Bạn không có quyền chuyển phiếu cho nhân viên khác." }, { status: 403 });
  if (body?.status && !oneOf(body.status, ["Mới", "Đang xử lý", "Chờ khách", "Đã đóng"] as const))
    return NextResponse.json({ error: "Trạng thái phiếu không hợp lệ." }, { status: 400 });
  if (body?.resolution && !oneOf(body.resolution, ["Thu hàng - Hoàn tiền", "Đổi hàng", "Điều chỉnh cách dùng", "Khác"] as const))
    return NextResponse.json({ error: "Hướng xử lý không hợp lệ." }, { status: 400 });
  if (body?.priority && !oneOf(body.priority, ["Bình thường", "Cao", "Khẩn cấp"] as const))
    return NextResponse.json({ error: "Mức ưu tiên không hợp lệ." }, { status: 400 });
  if (body?.owner && !(await db.collection(collections.users).findOne({ name: body.owner, active: true })))
    return NextResponse.json({ error: "Nhân viên phụ trách không tồn tại hoặc đã bị khóa." }, { status: 400 });
  const openScope = { ...scope, status: { $ne: "Đã đóng" } };
  if (body?.note) {
    const content = cleanText(body.note, 1000);
    if (!content) return NextResponse.json({ error: "Nội dung cập nhật không được để trống." }, { status: 400 });
    const entry = { id: `CN-${Date.now()}`, content, author: user?.name || "Hệ thống", createdAt: new Date().toISOString() };
    const result = await db.collection<{ updates?: typeof entry[]; updatedAt?: string }>(collections.tickets).updateOne(openScope, { $push: { updates: entry }, $set: { updatedAt: entry.createdAt } });
    if (!result.matchedCount)
      return NextResponse.json({ error: "Phiếu đã đóng. Vui lòng tải lại trang." }, { status: 409 });
    await writeAudit(user, "update", "ticket", id, before, { note: entry });
    return NextResponse.json({ data: entry });
  }
  const allowed = [
    "status",
    "owner",
    "priority",
    "title",
    "description",
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
  const now = new Date().toISOString();
  const result = await db
    .collection(collections.tickets)
    .findOneAndUpdate(
      openScope,
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
