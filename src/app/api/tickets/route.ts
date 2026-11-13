import { NextRequest, NextResponse } from "next/server";
import { collections, listTickets } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

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
  const db = await getDatabase();
  const customer = await db.collection(collections.customers).findOne({
    id: body.customerId,
    ...(user?.role === "admin" ? {} : { owner: user?.name }),
  });
  if (!customer)
    return NextResponse.json(
      { error: "Khách hàng không thuộc phạm vi phụ trách của bạn." },
      { status: 403 },
    );
  const relatedOrder = body.orderCode
    ? await db.collection(collections.orders).findOne({ code: body.orderCode, customerId: customer.id })
    : null;
  if (body.orderCode && !relatedOrder)
    return NextResponse.json({ error: "Đơn hàng không thuộc khách hàng đã chọn." }, { status: 400 });
  const products = (relatedOrder?.products || []) as Array<{ sku?: string; name?: string; quantity?: number }>;
  const returned = body.returnProductSku ? products.find((item) => item.sku === body.returnProductSku) : null;
  const exchanged = body.exchangeProductSku ? products.find((item) => item.sku === body.exchangeProductSku) : null;
  if ((body.returnProductSku && !returned) || (body.exchangeProductSku && !exchanged))
    return NextResponse.json({ error: "Sản phẩm không thuộc đơn hàng đã chọn." }, { status: 400 });
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
    orderCode: relatedOrder?.code || "",
    returnProductSku: returned?.sku || "",
    returnProductName: returned?.name || "",
    returnQuantity: returned ? Math.max(1, Math.min(Number(body.returnQuantity || 1), Number(returned.quantity || 1))) : undefined,
    exchangeProductSku: exchanged?.sku || "",
    exchangeProductName: exchanged?.name || "",
    exchangeQuantity: exchanged ? Math.max(1, Number(body.exchangeQuantity || 1)) : undefined,
    resolution: [
      "Thu hàng - Hoàn tiền",
      "Đổi hàng",
      "Điều chỉnh cách dùng",
      "Khác",
    ].includes(body.resolution)
      ? body.resolution
      : "Khác",
    createdAt: new Date().toISOString(),
  };
  await db.collection(collections.tickets).insertOne(document);
  await writeAudit(user, "create", "ticket", document.id, null, document);
  return NextResponse.json({ data: document }, { status: 201 });
}
