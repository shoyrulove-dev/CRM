import { NextRequest, NextResponse } from "next/server";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isInternalRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Phase 2: acquire MongoDB lock, materialize due care tasks, reconcile Haravan sync events.
  return NextResponse.json({ ok: true, processed: 0, timestamp: new Date().toISOString() });
}
