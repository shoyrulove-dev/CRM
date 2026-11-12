import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const publicPaths = ["/login", "/api/auth/login", "/api/health"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Internal endpoints perform their own constant-time Bearer secret validation.
  if (
    publicPaths.includes(pathname) ||
    pathname.startsWith("/api/internal/") ||
    pathname === "/api/webhooks/haravan" ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  )
    return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await verifySessionToken(token);
      if (pathname === "/login")
        return NextResponse.redirect(new URL("/", request.url));
      return NextResponse.next();
    } catch {
      /* invalid or expired session */
    }
  }

  if (pathname.startsWith("/api/"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
