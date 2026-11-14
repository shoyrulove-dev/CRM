import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  const publicOrigin = process.env.APP_URL || request.headers.get("origin") || request.url;
  const response = NextResponse.redirect(new URL("/login", publicOrigin), 303);
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  return response;
}
