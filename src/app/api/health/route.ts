import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/mongodb";

export const dynamic = "force-dynamic";
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "nichiei-crm",
    databaseConfigured: hasDatabase(),
    timestamp: new Date().toISOString(),
  });
}
