import { NextRequest, NextResponse } from "next/server";
import { isInternalOrAdminRequest } from "@/lib/internal-auth";
import { syncHaravanLoyalty } from "@/lib/haravan-loyalty-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  if (!(await isInternalOrAdminRequest(request)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, data: await syncHaravanLoyalty() });
  } catch (error) {
    return NextResponse.json({ ok: false,
      error: error instanceof Error ? error.message : "Đồng bộ Loyalty V2 thất bại.",
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
