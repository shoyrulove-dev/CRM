import { NextResponse } from "next/server";
import { isInternalRequest } from "@/lib/internal-auth";
import { seedDemoData } from "@/lib/data-store";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

async function isAdminRequest(request: Request) {
  if (isInternalRequest(request)) return true;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(";").map(value => value.trim()).find(value => value.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return false;
  try { return (await verifySessionToken(token)).role === "admin"; } catch { return false; }
}

export async function POST(request: Request) {
  if (!await isAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const seeded = await seedDemoData();
    return NextResponse.json({ ok: true, seeded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seed failed" }, { status: 503 });
  }
}
