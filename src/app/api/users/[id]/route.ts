import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
import { canManageAccount, canCreateRole } from "@/lib/account-access";
import { hasBrokenText } from "@/lib/validation";
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  if (!current || !["super_admin", "admin"].includes(current.role))
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
  if (hasBrokenText(body?.name) || (typeof body?.name === "string" && body.name.includes("?")))
    return NextResponse.json({ error: "Họ tên có ký tự bị lỗi. Vui lòng nhập lại bằng tiếng Việt." }, { status: 400 });
  const before = await db
    .collection(collections.users)
    .findOne({ id }, { projection: { _id: 0, passwordHash: 0, resetTokenHash: 0, resetExpiresAt: 0 } });
  if (!before)
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản." },
      { status: 404 },
    );
  if (!canManageAccount(current, before as never))
    return NextResponse.json({ error: "Bạn không được quản lý tài khoản này." }, { status: 403 });
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body?.name) update.name = String(body.name).trim();
  if (["admin", "sales", "care"].includes(body?.role)) {
    if (!canCreateRole(current, body.role))
      return NextResponse.json({ error: "Bạn không được chuyển sang vai trò này." }, { status: 403 });
    update.role = body.role;
  }
  if (current.role === "super_admin" && before.role === "admin" && typeof body?.canManageUsers === "boolean")
    update.canManageUsers = body.canManageUsers;
  if (typeof body?.groupId === "string") update.groupId = body.groupId;
  let revoke = false;
  if (body?.email !== undefined) {
    if (current.role !== "super_admin")
      return NextResponse.json({ error: "Chỉ Super Admin được đổi email đăng nhập." }, { status: 403 });
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
    if (email !== before.email) {
      update.email = email;
      revoke = true;
    }
  }
  if (typeof body?.active === "boolean") {
    if (id === current.id && !body.active)
      return NextResponse.json(
        { error: "Bạn không thể tự khóa tài khoản đang sử dụng." },
        { status: 400 },
      );
    update.active = body.active;
    revoke ||= body.active !== before.active;
  }
  if (body?.password) {
    if (String(body.password).length < 8 || String(body.password).length > 128)
      return NextResponse.json(
        { error: "Mật khẩu cần ít nhất 8 ký tự." },
        { status: 400 },
      );
    update.passwordHash = await hash(String(body.password), 10);
    update.mustChangePassword = true;
    revoke = true;
  }
  const credentialsChanged = Boolean(body?.password || update.email);
  const result = await db
    .collection(collections.users)
    .findOneAndUpdate(
      { id },
      { $set: update, ...(revoke ? { $inc: { sessionVersion: 1 } } : {}), ...(credentialsChanged ? { $unset: { resetTokenHash: "", resetExpiresAt: "", resetRequestedAt: "" } } : {}) },
      { returnDocument: "after", projection: { _id: 0, passwordHash: 0, resetTokenHash: 0, resetExpiresAt: 0 } },
    ).catch((error: unknown) => {
      if ((error as { code?: number }).code === 11000) return null;
      throw error;
    });
  if (!result)
    return NextResponse.json({ error: "Email này đã có tài khoản hoặc tài khoản không còn tồn tại." }, { status: 409 });
  // A newly issued password must not inherit the old failed-password lockout.
  if (body?.password)
    await db.collection(collections.loginAttempts).deleteMany({ email: before.email });
  await writeAudit(current, "update", "user", id, before, result);
  return NextResponse.json({ data: result });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentUser();
  const permanent = request.nextUrl.searchParams.get("mode") === "permanent";
  if (!current || !["super_admin", "admin"].includes(current.role))
    return NextResponse.json(
      { error: "Bạn không có quyền lưu trữ tài khoản." },
      { status: 403 },
    );
  const { id } = await params;
  if (id === current.id)
    return NextResponse.json(
      { error: "Bạn không thể xóa hoặc lưu trữ tài khoản đang sử dụng." },
      { status: 400 },
    );
  if (permanent && current.role !== "super_admin")
    return NextResponse.json({ error: "Chỉ Super Admin được xóa tài khoản." }, { status: 403 });
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const db = await getDatabase();
  const before = await db
    .collection(collections.users)
    .findOne({ id }, { projection: { _id: 0, passwordHash: 0, resetTokenHash: 0, resetExpiresAt: 0 } });
  if (!before)
    return NextResponse.json(
      { error: "Không tìm thấy tài khoản." },
      { status: 404 },
    );
  if (!canManageAccount(current, before as never))
    return NextResponse.json({ error: "Bạn không được quản lý tài khoản này." }, { status: 403 });
  if (permanent) {
    const deleted = await db.collection(collections.users).findOneAndDelete(
      { id, role: before.role },
      { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1 } },
    );
    if (!deleted)
      return NextResponse.json({ error: "Tài khoản đã thay đổi. Vui lòng tải lại danh sách." }, { status: 409 });
    await writeAudit(current, "delete", "user", id, deleted);
    return NextResponse.json({ ok: true });
  }
  const archivedAt = new Date().toISOString();
  const result = await db
    .collection(collections.users)
    .findOneAndUpdate(
      { id },
      {
        $set: { active: false, archivedAt, updatedAt: archivedAt },
        $inc: { sessionVersion: 1 },
      },
      { returnDocument: "after", projection: { _id: 0, passwordHash: 0, resetTokenHash: 0, resetExpiresAt: 0 } },
    );
  await writeAudit(current, "archive", "user", id, before, result);
  return NextResponse.json({ data: result });
}
