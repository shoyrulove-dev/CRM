import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: "MongoDB chưa được cấu hình." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body?.customerId || !body?.purpose || !body?.channel || !body?.contactStatus || !body?.result) return NextResponse.json({ error: "Vui lòng nhập đủ thông tin bắt buộc." }, { status: 400 });
  const db = await getDatabase();
  const occurredAt = body.occurredAt || new Date().toISOString();
  const careAttempt = await db.collection(collections.careActivities).countDocuments({ customerId: body.customerId }) + 1;
  let dueOffsetDays: number | undefined;
  let repurchaseTimely: boolean | undefined;
  if (body.productEndDate) {
    dueOffsetDays = Math.floor((new Date(occurredAt).getTime() - new Date(body.productEndDate).getTime()) / 86400000);
    if (String(body.purpose).includes("Nhắc tái mua")) repurchaseTimely = dueOffsetDays >= -7 && dueOffsetDays <= 3;
  }
  const document = {
    id: `NK-${Date.now().toString().slice(-6)}`, customerId: body.customerId, orderId: body.orderId || "", careAttempt,
    occurredAt, channel: body.channel, purpose: body.purpose, contactStatus: body.contactStatus, result: body.result,
    noPurchaseReason: body.noPurchaseReason || "", healthGoal: body.healthGoal || "", purchaseChannel: body.purchaseChannel || "",
    productEndDate: body.productEndDate || "", dueOffsetDays, repurchaseTimely, satisfaction: body.satisfaction ? Number(body.satisfaction) : undefined,
    adverseReaction: Boolean(body.adverseReaction), note: body.note || "", employee: body.employee || "Vân Anh", createdAt: new Date().toISOString(),
  };
  await db.collection(collections.careActivities).insertOne(document);
  return NextResponse.json({ data: document }, { status: 201 });
}
