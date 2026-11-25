import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
import { canSeeAll, hasPermission } from "@/lib/session";
import { hasBrokenText } from "@/lib/validation";
import { createEntityId } from "@/lib/entity-id";
import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";

export async function POST(request: NextRequest) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  if (hasBrokenText([body?.purpose, body?.note, body?.employee, body?.result, body?.noPurchaseReason, body?.healthGoal]))
    return NextResponse.json({ error: "Nội dung có ký tự bị lỗi. Vui lòng nhập lại bằng tiếng Việt." }, { status: 400 });
  if (
    !body?.customerId ||
    !body?.purpose ||
    !body?.channel ||
    !body?.contactStatus ||
    !body?.result
  )
    return NextResponse.json(
      { error: "Vui lòng nhập đủ thông tin bắt buộc." },
      { status: 400 },
    );
  const db = await getDatabase();
  const user = await getCurrentUser();
  if (!hasPermission(user, "care"))
    return NextResponse.json(
      { error: "Bạn không có quyền ghi nhận chăm sóc." },
      { status: 403 },
    );
  const customer = await db.collection(collections.customers).findOne({
    id: body.customerId,
    ...(canSeeAll(user) ? {} : { owner: user?.name }),
  });
  if (!customer)
    return NextResponse.json(
      { error: "Khách hàng không thuộc phạm vi phụ trách của bạn." },
      { status: 403 },
    );
  const activityCollection = db.collection(collections.careActivities);
  let activityKey: ObjectId | undefined;
  if (body.taskId !== undefined) {
    if (typeof body.taskId !== "string" || typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId))
      return NextResponse.json({ error: "Yêu cầu ghi nhận lịch không hợp lệ." }, { status: 400 });
    const task = await db.collection(collections.careTasks).findOne({
      id: body.taskId,
      customerId: customer.id,
      ...(canSeeAll(user) ? {} : { owner: user!.name }),
    });
    if (!task)
      return NextResponse.json({ error: "Lịch chăm sóc không thuộc phạm vi truy cập." }, { status: 404 });
    activityKey = new ObjectId(createHash("sha256").update(JSON.stringify([user!.id, task.id, body.requestId])).digest("hex").slice(0, 24));
    const existing = await activityCollection.findOne({ _id: activityKey }, { projection: { _id: 0 } });
    if (existing) return NextResponse.json({ data: existing });
    if (body.orderId && !await db.collection(collections.orders).findOne({ id: body.orderId, customerId: customer.id }))
      return NextResponse.json({ error: "Đơn hàng không thuộc khách hàng này." }, { status: 400 });
  }
  const occurredAt = body.occurredAt || new Date().toISOString();
  const careAttempt =
    (await db
      .collection(collections.careActivities)
      .countDocuments({ customerId: body.customerId })) + 1;
  let dueOffsetDays: number | undefined;
  let repurchaseTimely: boolean | undefined;
  if (body.productEndDate) {
    dueOffsetDays = Math.floor(
      (new Date(occurredAt).getTime() -
        new Date(body.productEndDate).getTime()) /
        86400000,
    );
    if (String(body.purpose).includes("Nhắc tái mua"))
      repurchaseTimely = dueOffsetDays >= -7 && dueOffsetDays <= 3;
  }
  const document = {
    id: createEntityId("NK"),
    customerId: body.customerId,
    orderId: body.orderId || "",
    ...(activityKey ? { taskId: body.taskId } : {}),
    careAttempt,
    occurredAt,
    channel: body.channel,
    purpose: body.purpose,
    contactStatus: body.contactStatus,
    result: body.result,
    noPurchaseReason: body.noPurchaseReason || "",
    healthGoal: body.healthGoal || "",
    purchaseChannel: body.purchaseChannel || "",
    productEndDate: body.productEndDate || "",
    dueOffsetDays,
    repurchaseTimely,
    satisfaction: body.satisfaction ? Number(body.satisfaction) : undefined,
    adverseReaction: Boolean(body.adverseReaction),
    note: body.note || "",
    employee:
      canSeeAll(user)
        ? body.employee || user!.name
        : user?.name || "Chưa phân công",
    createdAt: new Date().toISOString(),
  };
  try {
    await activityCollection.insertOne(activityKey ? { ...document, _id: activityKey } : document);
  } catch (error) {
    if (activityKey && (error as { code?: number }).code === 11000) {
      const existing = await activityCollection.findOne({ _id: activityKey }, { projection: { _id: 0 } });
      if (existing) return NextResponse.json({ data: existing });
    }
    throw error;
  }
  const nextCareDate = new Date(occurredAt);
  nextCareDate.setDate(nextCareDate.getDate() + 30);
  await db
    .collection(collections.customers)
    .updateOne(
      { id: body.customerId },
      {
        $set: {
          lastCare: occurredAt,
          nextCare: nextCareDate.toISOString(),
          status: "due",
        },
      },
    );
  await writeAudit(
    user,
    "create",
    "care_activity",
    document.id,
    null,
    document,
  );
  return NextResponse.json({ data: document }, { status: 201 });
}
