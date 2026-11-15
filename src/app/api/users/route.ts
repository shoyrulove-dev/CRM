import { hash } from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/users";
import { canCreateRole, canOpenAccounts } from "@/lib/account-access";
import { hasBrokenText } from "@/lib/validation";

async function admin() {
  const user = await getCurrentUser();
  return canOpenAccounts(user);
}
export async function GET() {
  if (!(await admin()))
    return NextResponse.json(
      { error: "Bạn không có quyền xem tài khoản." },
      { status: 403 },
    );
  return NextResponse.json({ data: await listUsers() });
}
export async function POST(request: NextRequest) {
  if (!(await admin()))
    return NextResponse.json(
      { error: "Bạn không có quyền tạo tài khoản." },
      { status: 403 },
    );
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  if (hasBrokenText(body?.name) || (typeof body?.name === "string" && body.name.includes("?")))
    return NextResponse.json({ error: "Họ tên có ký tự bị lỗi. Vui lòng nhập lại bằng tiếng Việt." }, { status: 400 });
  if (
    !body?.name ||
    !body?.email ||
    !["admin", "sales", "care"].includes(body.role)
  )
    return NextResponse.json(
      { error: "Vui lòng nhập đủ họ tên, email, mật khẩu và nhóm quyền." },
      { status: 400 },
    );
  const current = await getCurrentUser();
  if (!current || !canCreateRole(current, body.role))
    return NextResponse.json({ error: "Bạn không được tạo tài khoản thuộc vai trò này." }, { status: 403 });
  const password = body.password ? String(body.password) : `Nh!${randomBytes(12).toString("base64url")}9`;
  if (password.length < 8 || password.length > 128)
    return NextResponse.json(
      { error: "Mật khẩu cần ít nhất 8 ký tự." },
      { status: 400 },
    );
  const db = await getDatabase(),
    email = String(body.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  if (await db.collection(collections.users).findOne({ email }))
    return NextResponse.json(
      { error: "Email này đã có tài khoản." },
      { status: 409 },
    );
  const document = {
    id: `NV-${randomUUID()}`,
    name: String(body.name).trim(),
    email,
    role: body.role,
    groupId: body.groupId || "",
    canManageUsers: current.role === "super_admin" && body.role === "admin" && body.canManageUsers === true,
    active: true,
    sessionVersion: 0,
    passwordHash: await hash(password, 10),
    mustChangePassword: true,
    createdAt: new Date().toISOString(),
  };
  await db.collection(collections.users).insertOne(document);
  return NextResponse.json(
    { data: { ...document, passwordHash: undefined }, temporaryPassword: password },
    { status: 201 },
  );
}
