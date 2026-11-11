import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
const allowed = [
  "channel",
  "purpose",
  "contactStatus",
  "result",
  "noPurchaseReason",
  "healthGoal",
  "satisfaction",
  "adverseReaction",
  "note",
  "productEndDate",
];
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const user = await getCurrentUser(),
    { id } = await params,
    body = await request.json().catch(() => null),
    update = Object.fromEntries(
      Object.entries(body || {}).filter(([k]) => allowed.includes(k)),
    ),
    filter = {
      id,
      ...(user?.role === "admin" ? {} : { employee: user?.name }),
    };
  if (!hasPermission(user, "care"))
    return NextResponse.json({ error: "Bạn không có quyền sửa nhật ký." }, { status: 403 });
  const result = await (await getDatabase())
    .collection(collections.careActivities)
    .findOneAndUpdate(
      filter,
      { $set: { ...update, updatedAt: new Date().toISOString() } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  return result
    ? NextResponse.json({ data: result })
    : NextResponse.json(
        { error: "Không tìm thấy hoặc bạn không được sửa nhật ký này." },
        { status: 404 },
      );
}
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const user = await getCurrentUser();
  if (!hasPermission(user, "care"))
    return NextResponse.json({ error: "Bạn không có quyền xóa nhật ký." }, { status: 403 });
  const { id } = await params,
    filter = {
      id,
      ...(user?.role === "admin" ? {} : { employee: user?.name }),
    },
    result = await (await getDatabase())
      .collection(collections.careActivities)
      .deleteOne(filter);
  return result.deletedCount
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { error: "Không tìm thấy hoặc bạn không được xóa nhật ký này." },
        { status: 404 },
      );
}
