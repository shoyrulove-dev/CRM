import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { authenticateUser } from "@/lib/users";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  if (!body?.email || !body.password)
    return NextResponse.json(
      { error: "Vui lòng nhập email và mật khẩu." },
      { status: 400 },
    );
  const email = body.email.trim().toLowerCase();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const key = `${email}:${ip}`,
    now = new Date();
  if (hasDatabase()) {
    const db = await getDatabase(),
      attempt = await db.collection(collections.loginAttempts).findOne({ key });
    if (
      attempt &&
      Number(attempt.count) >= 5 &&
      new Date(String(attempt.expiresAt)) > now
    )
      return NextResponse.json(
        { error: "Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút." },
        { status: 429 },
      );
  }
  const user = await authenticateUser(email, body.password);
  if (!user) {
    if (hasDatabase())
      await (await getDatabase())
        .collection(collections.loginAttempts)
        .updateOne(
          { key },
          {
            $inc: { count: 1 },
            $set: {
              email,
              ip,
              expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
              updatedAt: now,
            },
          },
          { upsert: true },
        );
    return NextResponse.json(
      { error: "Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa." },
      { status: 401 },
    );
  }
  if (hasDatabase()) {
    const db = await getDatabase();
    await Promise.all([
      db.collection(collections.loginAttempts).deleteOne({ key }),
      db
        .collection(collections.users)
        .updateOne(
          { id: user.id },
          { $set: { lastLoginAt: now.toISOString() } },
        ),
    ]);
  }
  const token = await createSessionToken(user),
    response = NextResponse.json({ ok: true, user });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return response;
}
