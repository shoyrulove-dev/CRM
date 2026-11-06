import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { authenticateUser } from "@/lib/users";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password) return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu." }, { status: 400 });

  const user = await authenticateUser(body.email.trim().toLowerCase(), body.password);
  if (!user) return NextResponse.json({ error: "Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa." }, { status: 401 });
  const token = await createSessionToken(user);
  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
  return response;
}
