import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { collections } from "@/lib/data-store";
import { getDatabase } from "@/lib/mongodb";
import { writeAudit } from "@/lib/audit";
import { hasBrokenText } from "@/lib/validation";
const valid = ["customers", "care", "tickets", "reports"];
export async function PATCH(
  r: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (user?.role !== "super_admin")
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const { id } = await params,
    b = await r.json(),
    set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (hasBrokenText(b?.name))
    return NextResponse.json({ error: "Tên nhóm có ký tự bị lỗi. Vui lòng nhập lại." }, { status: 400 });
  if (b.name) set.name = String(b.name).trim();
  if (Array.isArray(b.permissions))
    set.permissions = b.permissions.filter((x: string) => valid.includes(x));
  const db = await getDatabase();
  const before = await db
    .collection(collections.permissionGroups)
    .findOne({ id });
  const data = await db
    .collection(collections.permissionGroups)
    .findOneAndUpdate(
      { id },
      { $set: set },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  await writeAudit(user, "update", "permission_group", id, before, data);
  return NextResponse.json({ data });
}
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if ((await getCurrentUser())?.role !== "super_admin")
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
