import { compare, hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

const DEMO_EMAIL = "admin@nichiei.vn";
const DEMO_PASSWORD = "Nichiei@2026";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body.password) return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu." }, { status: 400 });

  const expectedPassword = process.env.DEMO_ADMIN_PASSWORD || DEMO_PASSWORD;
  const passwordHash = await hash(expectedPassword, 10);
  const validEmail = body.email.trim().toLowerCase() === DEMO_EMAIL;
  const validPassword = await compare(body.password, passwordHash);
  if (!validEmail || !validPassword) return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });

  const token = await createSessionToken({ id: "demo-admin", name: "Vân Anh", email: DEMO_EMAIL, role: "admin" });
  const response = NextResponse.json({ ok: true, user: { name: "Vân Anh", email: DEMO_EMAIL, role: "admin" } });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 12, path: "/" });
  return response;
}
