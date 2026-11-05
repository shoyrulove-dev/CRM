import { NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: "MongoDB chưa được cấu hình." }, { status: 503 });
  const { id } = await context.params;
  const result = await (await getDatabase()).collection(collections.careActivities).deleteOne({ id });
  return result.deletedCount
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "Không tìm thấy nhật ký." }, { status: 404 });
}
