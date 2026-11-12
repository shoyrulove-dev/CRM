import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import type { UserAccount } from "@/lib/types";

export async function POST(request: NextRequest) {
  const current = await getCurrentUser();
  if (!current)
    return NextResponse.json({ error: "Phiên đăng nhập đã hết hạn." }, { status: 401 });
  if (!hasDatabase())
    return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;
  if (!body?.currentPassword || !body.newPassword)
    return NextResponse.json({ error: "Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới." }, { status: 400 });
  if (body.newPassword.length < 8)
    return NextResponse.json({ error: "Mật khẩu mới cần ít nhất 8 ký tự." }, { status: 400 });
  if (body.currentPassword === body.newPassword)
    return NextResponse.json({ error: "Mật khẩu mới cần khác mật khẩu hiện tại." }, { status: 400 });

  const db = await getDatabase();
  const account = await db.collection<UserAccount>(collections.users).findOne({
    id: current.id,
    active: true,
  });
  if (!account || !(await compare(body.currentPassword, account.passwordHash)))
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng." }, { status: 400 });

  const sessionVersion = Number(account.sessionVersion || 0) + 1;
  await db.collection(collections.users).updateOne(
    { id: current.id },
    {
      $set: {
        passwordHash: await hash(body.newPassword, 10),
        sessionVersion,
        passwordChangedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  );

  const user = { ...current, sessionVersion };
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return response;
}
