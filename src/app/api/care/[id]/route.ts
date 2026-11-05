import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: "MongoDB chưa được cấu hình." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const allowed = ["status", "owner", "dueAt", "purpose", "channel"];
  const update = Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(update).length) return NextResponse.json({ error: "Không có dữ liệu hợp lệ." }, { status: 400 });
  const result = await (await getDatabase()).collection(collections.careTasks).findOneAndUpdate({ id }, { $set: { ...update, updatedAt: new Date().toISOString() } }, { returnDocument: "after", projection: { _id: 0 } });
  return result ? NextResponse.json({ data: result }) : NextResponse.json({ error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
}
