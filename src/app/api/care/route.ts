import { NextRequest, NextResponse } from "next/server";
import { collections, listCareTasks } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { cleanText, oneOf, validDate } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
const channels = ["Gọi điện", "Zalo", "Facebook", "SMS", "Trực tiếp"] as const;
export async function GET() {
  const user = await getCurrentUser();
  if (!hasPermission(user, "care"))
    return NextResponse.json(
      { error: "Bạn không có quyền xem lịch chăm sóc." },
      { status: 403 },
    );
  return NextResponse.json({
    data: await listCareTasks(user),
    source: hasDatabase() ? "mongodb" : "demo",
  });
}
export async function POST(request: NextRequest) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null),
    user = await getCurrentUser();
  if (!hasPermission(user, "care"))
    return NextResponse.json(
      { error: "Bạn không có quyền tạo lịch chăm sóc." },
      { status: 403 },
    );
  if (!body?.customerId || !body?.purpose || (!body?.dueAt && !body?.baseDate))
    return NextResponse.json(
      { error: "Vui lòng chọn khách hàng, nội dung và ngày chăm sóc." },
      { status: 400 },
    );
  const db = await getDatabase(),
    customer = await db
      .collection(collections.customers)
      .findOne({
        id: body.customerId,
        ...(user?.role === "admin" ? {} : { owner: user?.name }),
      });
  if (!customer)
    return NextResponse.json(
      { error: "Khách hàng không thuộc phạm vi phụ trách của bạn." },
      { status: 403 },
    );
  const relatedOrder = body.orderId
    ? await db.collection(collections.orders).findOne({ id: body.orderId, customerId: customer.id })
    : null;
  if (body.orderId && !relatedOrder)
    return NextResponse.json({ error: "Đơn hàng không thuộc khách hàng đã chọn." }, { status: 400 });
  const relatedProduct = body.productSku && relatedOrder
    ? (relatedOrder.products || []).find((item: { sku?: string }) => item.sku === body.productSku)
    : null;
  if (body.productSku && !relatedProduct)
    return NextResponse.json({ error: "Sản phẩm không thuộc đơn hàng đã chọn." }, { status: 400 });
  let dueAt = body.dueAt;
  if (!dueAt && body.baseDate) {
    const date = new Date(`${body.baseDate}T09:00:00+07:00`);
    date.setDate(date.getDate() + Number(body.offsetDays || 0));
    dueAt = date.toISOString();
  }
  if (!validDate(dueAt) || !oneOf(body.channel || "Gọi điện", channels))
    return NextResponse.json(
      { error: "Ngày hoặc kênh chăm sóc không hợp lệ." },
      { status: 400 },
    );
  const owner =
    user?.role === "admin"
      ? cleanText(body.owner || user.name, 120)
      : user?.name || "Chưa phân công";
  if (
    !(await db
      .collection(collections.users)
      .findOne({ name: owner, active: true }))
  )
    return NextResponse.json(
      { error: "Nhân viên phụ trách không tồn tại hoặc đã bị khóa." },
      { status: 400 },
    );
  const document = {
    id: `CS-${Date.now().toString().slice(-6)}`,
    customerId: customer.id,
    customer: customer.name,
    phone: customer.phone,
    purpose: cleanText(body.purpose, 200),
    owner,
    dueAt,
    offsetDays: Number(body.offsetDays || 0) || undefined,
    channel: body.channel || "Gọi điện",
    recurrence: ["monthly", "yearly"].includes(body.recurrence)
      ? body.recurrence
      : "none",
    orderId: relatedOrder?.id || "",
    orderCode: relatedOrder?.code || "",
    productSku: relatedProduct?.sku || "",
    productName: relatedProduct?.name || "",
    status: "due",
    createdAt: new Date().toISOString(),
  };
  await db.collection(collections.careTasks).insertOne(document);
  await writeAudit(user, "create", "care_task", document.id, null, document);
  return NextResponse.json({ data: document }, { status: 201 });
}
