import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";

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
  const now = new Date().toISOString();
  const result = await (
    await getDatabase()
  )
    .collection(collections.tickets)
    .findOneAndUpdate(
      { id, ...(user?.role === "admin" ? {} : { owner: user?.name }) },
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
  const result = await (
    await getDatabase()
  )
    .collection(collections.tickets)
    .deleteOne({
      id,
      ...(user?.role === "admin" ? {} : { owner: user?.name }),
    });
  return result.deletedCount
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { error: "Không tìm thấy phiếu hoặc bạn không được xóa." },
        { status: 404 },
      );
}
