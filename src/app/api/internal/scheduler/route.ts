import { NextRequest, NextResponse } from "next/server";
import { isInternalOrAdminRequest } from "@/lib/internal-auth";
import { runScheduler } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!await isInternalOrAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runScheduler();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Scheduler failed" }, { status: 500 });
  }
}
