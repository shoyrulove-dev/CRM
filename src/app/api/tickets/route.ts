import { NextRequest, NextResponse } from "next/server";
import { collections, listTickets } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!hasPermission(user, "tickets"))
    return NextResponse.json(
      { error: "Bạn không có quyền xem phiếu yêu cầu." },
      { status: 403 },
    );
  return NextResponse.json({
    data: await listTickets(user),
    source: hasDatabase() ? "mongodb" : "demo",
  });
}
export async function POST(request: NextRequest) {
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  const user = await getCurrentUser();
  if (!hasPermission(user, "tickets"))
    return NextResponse.json(
      { error: "Bạn không có quyền tạo phiếu yêu cầu." },
      { status: 403 },
    );
  if (!body?.customerId || !body?.title)
    return NextResponse.json(
      { error: "Khách hàng và nội dung là bắt buộc." },
      { status: 400 },
    );
  const document = {
    id: `YC-${Date.now().toString().slice(-6)}`,
    customerId: body.customerId,
    customer: body.customer || "",
    title: body.title,
    description: body.description || "",
    priority: body.priority || "Bình thường",
    status: "Mới",
    owner:
      user?.role === "admin"
        ? body.owner || user.name
        : user?.name || "Chưa phân công",
    orderCode: body.orderCode || "",
    createdAt: new Date().toISOString(),
  };
  await (await getDatabase())
    .collection(collections.tickets)
    .insertOne(document);
  return NextResponse.json({ data: document }, { status: 201 });
}
