import { NextResponse } from "next/server";
import { isInternalOrAdminRequest } from "@/lib/internal-auth";
import { seedDemoData } from "@/lib/data-store";

export async function POST(request: Request) {
  if (!await isInternalOrAdminRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const seeded = await seedDemoData();
    return NextResponse.json({ ok: true, seeded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Seed failed" }, { status: 503 });
  }
}
