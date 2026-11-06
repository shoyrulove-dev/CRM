import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import type { CareTask } from "@/lib/types";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const allowed = ["status", "owner", "dueAt", "purpose", "channel", "customer", "phone"];
  const update = Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(update).length) return NextResponse.json({ error: "Không có dữ liệu hợp lệ." }, { status: 400 });
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.collection(collections.careTasks).findOneAndUpdate({ id }, { $set: { ...update, updatedAt: now, ...(update.status === "done" ? { completedAt: now } : {}) } }, { returnDocument: "after", projection: { _id: 0 } }) as CareTask | null;
  if (!result) return NextResponse.json({ error: "Không tìm thấy nhiệm vụ." }, { status: 404 });
  if (update.status === "done" && result.recurrence && result.recurrence !== "none") {
    const nextDue = new Date(result.dueAt);
    if (result.recurrence === "monthly") nextDue.setMonth(nextDue.getMonth() + 1); else nextDue.setFullYear(nextDue.getFullYear() + 1);
    const nextId = `${result.id}-R-${nextDue.toISOString().slice(0, 10)}`;
    await db.collection(collections.careTasks).updateOne({ id: nextId }, { $setOnInsert: { ...result, id: nextId, dueAt: nextDue.toISOString(), status: "due", completedAt: null, createdAt: now, parentTaskId: result.id } }, { upsert: true });
  }
  return NextResponse.json({ data: result });
}
