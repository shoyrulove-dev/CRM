import { NextRequest, NextResponse } from "next/server";
import { isInternalOrAdminRequest } from "@/lib/internal-auth";
import { syncHaravanData } from "@/lib/haravan-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!(await isInternalOrAdminRequest(request)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await syncHaravanData()) });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Đồng bộ Haravan thất bại.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
