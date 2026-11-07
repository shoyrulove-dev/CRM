import { NextRequest, NextResponse } from "next/server";
import { listCustomers, collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { cleanText, validDate, validPhone } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers"))
    return NextResponse.json(
      { error: "Bạn không có quyền xem khách hàng." },
      { status: 403 },
    );
  const data = await listCustomers(
    request.nextUrl.searchParams.get("q") || undefined,
    user,
  );
  return NextResponse.json({
    data,
    source: hasDatabase() ? "mongodb" : "demo",
    total: data.length,
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
  if (!hasPermission(user, "customers"))
    return NextResponse.json(
      { error: "Bạn không có quyền tạo khách hàng." },
      { status: 403 },
    );
  if (!body?.name || !validPhone(body?.phone))
    return NextResponse.json(
      { error: "Tên và số điện thoại hợp lệ là bắt buộc." },
      { status: 400 },
    );
  if (body.birthDate && !validDate(body.birthDate))
    return NextResponse.json(
      { error: "Ngày sinh không hợp lệ." },
      { status: 400 },
    );
  const db = await getDatabase(),
    phone = cleanText(body.phone, 20);
  if (await db.collection(collections.customers).findOne({ phone }))
    return NextResponse.json(
      { error: "Số điện thoại đã tồn tại." },
      { status: 409 },
    );
  if (
    user?.role === "admin" &&
    body.owner &&
    !(await db
      .collection(collections.users)
      .findOne({ name: body.owner, active: true }))
  )
    return NextResponse.json(
      { error: "Nhân viên phụ trách không tồn tại hoặc đã bị khóa." },
      { status: 400 },
    );
  const document = {
    id: `KH-${Date.now().toString().slice(-6)}`,
    name: cleanText(body.name, 120),
    phone,
    owner:
      user?.role === "admin"
        ? cleanText(body.owner || user.name, 120)
        : user?.name || "Chưa phân công",
    segment: cleanText(body.segment || "Khách mới", 80),
    orders: 0,
    revenue: 0,
    lastOrder: "—",
    nextCare: body.nextCare || "—",
    status: "due",
    healthGoal: cleanText(body.healthGoal || "Chưa xác định", 120),
    birthDate: body.birthDate || "",
    createdAt: new Date().toISOString(),
  };
  await db.collection(collections.customers).insertOne(document);
  await writeAudit(user, "create", "customer", document.id, null, document);
  return NextResponse.json({ data: document }, { status: 201 });
}
