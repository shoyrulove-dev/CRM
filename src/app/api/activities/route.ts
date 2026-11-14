import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { writeAudit } from "@/lib/audit";
import { canSeeAll, hasPermission } from "@/lib/session";
import { hasBrokenText } from "@/lib/validation";

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
    id: `NK-${Date.now().toString().slice(-6)}`,
    customerId: body.customerId,
    orderId: body.orderId || "",
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
  await db.collection(collections.careActivities).insertOne(document);
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
