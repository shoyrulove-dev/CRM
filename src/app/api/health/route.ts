import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/mongodb";
import { getDatabase } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export async function GET() {
  if (!hasDatabase())
    return NextResponse.json(
      { status: "error", service: "nichiei-crm", database: "not-configured" },
      { status: 503 },
    );
  try {
    await (await getDatabase()).command({ ping: 1 });
    return NextResponse.json({
      status: "ok",
      service: "nichiei-crm",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { status: "error", service: "nichiei-crm", database: "unavailable" },
      { status: 503 },
    );
  }
}
