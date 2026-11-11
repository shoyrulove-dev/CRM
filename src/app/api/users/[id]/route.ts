import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  if (current?.role !== "admin")
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật tài khoản." },
      { status: 403 },
    );
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const { id } = await params,
    body = await request.json().catch(() => null),
    db = await getDatabase();
  const before = await db
    .collection(collections.users)
    .findOne({ id }, { projection: { _id: 0, passwordHash: 0 } });
  if (!before)
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản." },
      { status: 404 },
    );
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body?.name) update.name = String(body.name).trim();
  if (["admin", "sales", "care"].includes(body?.role)) update.role = body.role;
  if (typeof body?.groupId === "string") update.groupId = body.groupId;
  let revoke = false;
  if (typeof body?.active === "boolean") {
    if (id === current.id && !body.active)
      return NextResponse.json(
        { error: "Bạn không thể tự khóa tài khoản đang sử dụng." },
        { status: 400 },
      );
    update.active = body.active;
    revoke = body.active !== before.active;
  }
  if (body?.password) {
    if (String(body.password).length < 8)
      return NextResponse.json(
        { error: "Mật khẩu cần ít nhất 8 ký tự." },
        { status: 400 },
      );
    update.passwordHash = await hash(String(body.password), 10);
    revoke = true;
  }
  if (revoke) update.sessionVersion = Number(before.sessionVersion || 0) + 1;
  const result = await db
    .collection(collections.users)
    .findOneAndUpdate(
      { id },
      { $set: update },
      { returnDocument: "after", projection: { _id: 0, passwordHash: 0 } },
    );
  await writeAudit(current, "update", "user", id, before, result);
  return NextResponse.json({ data: result });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  if (current?.role !== "admin")
    return NextResponse.json(
      { error: "Bạn không có quyền lưu trữ tài khoản." },
      { status: 403 },
    );
  const { id } = await params;
  if (id === current.id)
    return NextResponse.json(
      { error: "Bạn không thể tự lưu trữ tài khoản đang sử dụng." },
      { status: 400 },
    );
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const db = await getDatabase();
  const before = await db
    .collection(collections.users)
    .findOne({ id }, { projection: { _id: 0, passwordHash: 0 } });
  if (!before)
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản." },
      { status: 404 },
    );
  const archivedAt = new Date().toISOString();
  const result = await db
    .collection(collections.users)
    .findOneAndUpdate(
      { id },
      {
        $set: { active: false, archivedAt, updatedAt: archivedAt },
        $inc: { sessionVersion: 1 },
      },
      { returnDocument: "after", projection: { _id: 0, passwordHash: 0 } },
    );
  await writeAudit(current, "archive", "user", id, before, result);
  return NextResponse.json({ data: result });
}
