import { NextRequest, NextResponse } from "next/server";
import { collections, getCustomerProfile } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll, hasPermission } from "@/lib/session";
import { cleanText, hasBrokenText } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export async function GET(
  _: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers"))
    return NextResponse.json({ error: "Bạn không có quyền xem khách hàng." }, { status: 403 });
  const profile = await getCustomerProfile(id, user);
  if (!profile.customer)
    return NextResponse.json(
      { error: "Không tìm thấy khách hàng." },
      { status: 404 },
    );
  return NextResponse.json(profile);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." },
      { status: 503 },
    );
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (hasBrokenText([body?.name, body?.owner, body?.segment, body?.healthGoal]))
    return NextResponse.json({ error: "Nội dung có ký tự bị lỗi. Vui lòng nhập lại bằng tiếng Việt." }, { status: 400 });
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers"))
    return NextResponse.json({ error: "Bạn không có quyền sửa khách hàng." }, { status: 403 });
  const allowed = [
    "name",
    "phone",
    "segment",
    "healthGoal",
    "birthDate",
    "nextCare",
    "status",
    ...(canSeeAll(user) ? ["owner"] : []),
  ];
  const update = Object.fromEntries(
    Object.entries(body || {}).filter(([key]) => allowed.includes(key)),
  );
  if (!Object.keys(update).length)
    return NextResponse.json(
      { error: "Không có thông tin hợp lệ để cập nhật." },
      { status: 400 },
    );
  for (const field of ["segment", "healthGoal"])
    if (field in update) update[field] = cleanText(update[field], field === "segment" ? 80 : 120) || "Chưa xác định";
  const result = await (await getDatabase())
    .collection(collections.customers)
    .findOneAndUpdate(
      { id, ...(canSeeAll(user) ? {} : { owner: user?.name }) },
      { $set: { ...update, ...(update.owner ? { ownerSource: "manual" } : {}), updatedAt: new Date().toISOString() } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
  if (result && update.owner) {
    const db = await getDatabase();
    await Promise.all([
      db.collection(collections.orders).updateMany(
        { customerId: id },
        { $set: { owner: update.owner, salesperson: update.owner } },
      ),
      db.collection(collections.careTasks).updateMany(
        { customerId: id, status: { $ne: "done" } },
        { $set: { owner: update.owner } },
      ),
      db.collection(collections.tickets).updateMany(
        { customerId: id, status: { $ne: "Đã đóng" } },
        { $set: { owner: update.owner } },
      ),
    ]);
  }
  if (result) await writeAudit(user, "update", "customer", id, null, result);
  return result
    ? NextResponse.json({ data: result })
    : NextResponse.json(
        { error: "Không tìm thấy khách hàng." },
        { status: 404 },
      );
}
