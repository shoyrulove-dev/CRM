import { NextRequest, NextResponse } from "next/server";
import { isInternalOrAdminRequest } from "@/lib/internal-auth";
import { syncHaravanData } from "@/lib/haravan-sync";
import { syncHaravanLoyalty } from "@/lib/haravan-loyalty-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  if (!(await isInternalOrAdminRequest(request)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncHaravanData();
    // A provider/DB error in Loyalty must not undo a successful commerce import.
    const loyalty = Date.now() - startedAt > 200_000 ? { status: "deferred" }
      : await syncHaravanLoyalty().catch((error) => ({
      status: "failed", error: error instanceof Error ? error.message : "Đồng bộ Loyalty V2 thất bại.",
    }));
    return NextResponse.json({ ok: true, ...result, loyalty });
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
