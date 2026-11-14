import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { canSeeAll, hasPermission } from "@/lib/session";
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "care"))
    return NextResponse.json(
      { error: "Không có quyền xem thông báo." },
      { status: 403 },
    );
  if (!hasDatabase()) return NextResponse.json({ data: [], unread: 0 });
  const db = await getDatabase(),
    now = new Date(),
    tomorrow = new Date(now.getTime() + 86400000).toISOString();
  const filter = {
    status: { $ne: "done" },
    dueAt: { $lte: tomorrow },
    ...(canSeeAll(user) ? {} : { owner: user.name }),
  };
  const tasks = await db
    .collection(collections.careTasks)
    .find(filter, { projection: { _id: 0 } })
    .sort({ dueAt: 1 })
    .limit(20)
    .toArray();
  const reads = new Set(
    (
      await db
        .collection(collections.notificationReads)
        .find({
          userId: user.id,
          taskId: { $in: tasks.map((item) => item.id) },
        })
        .toArray()
    ).map((item) => item.taskId),
  );
  const data = tasks.map((item) => ({
    ...item,
    read: reads.has(item.id),
    category:
      item.source === "birthday"
        ? "Sinh nhật"
        : item.source === "holiday"
          ? "Ngày lễ"
          : item.status === "overdue" || item.dueAt < now.toISOString()
            ? "Quá hạn"
            : "Hôm nay",
  }));
  return NextResponse.json({
    data,
    unread: data.filter((item) => !item.read).length,
  });
}
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !hasDatabase())
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null),
    ids: string[] = Array.isArray(body?.ids)
      ? body.ids.slice(0, 50).map(String)
      : [];
  if (ids.length)
    await (await getDatabase())
      .collection(collections.notificationReads)
      .bulkWrite(
        ids.map((taskId) => ({
          updateOne: {
            filter: { userId: user.id, taskId },
            update: { $set: { readAt: new Date().toISOString() } },
            upsert: true,
          },
        })),
      );
  return NextResponse.json({ ok: true });
}
