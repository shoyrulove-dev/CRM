import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { collections } from "@/lib/data-store";
import { getDatabase } from "@/lib/mongodb";
const valid = ["customers", "care", "tickets", "reports"];
export async function PATCH(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if ((await getCurrentUser())?.role !== "admin")
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const { id } = await params,
    b = await r.json(),
    set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (b.name) set.name = String(b.name).trim();
  if (Array.isArray(b.permissions))
    set.permissions = b.permissions.filter((x: string) => valid.includes(x));
  const data = await (await getDatabase())
    .collection(collections.permissionGroups)
    .findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  return NextResponse.json({ data });
}
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if ((await getCurrentUser())?.role !== "admin")
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const { id } = await params,
    db = await getDatabase();
  if (await db.collection(collections.users).findOne({ groupId: id }))
    return NextResponse.json(
      { error: "Nhóm đang có tài khoản sử dụng." },
      { status: 409 },
    );
  await db.collection(collections.permissionGroups).deleteOne({ id });
  return NextResponse.json({ ok: true });
}
