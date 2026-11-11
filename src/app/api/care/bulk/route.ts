import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { cleanText, validDate } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin")
    return NextResponse.json(
      { error: "Chỉ quản trị viên được tạo lịch hàng loạt." },
      { status: 403 },
    );
  if (!hasDatabase())
    return NextResponse.json(
      { error: "Kho dữ liệu chưa sẵn sàng." },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  if (!body?.purpose || !validDate(body?.dueAt))
    return NextResponse.json(
      { error: "Vui lòng nhập nội dung và thời gian chăm sóc." },
      { status: 400 },
    );
  const db = await getDatabase();
  const customerFilter: Record<string, unknown> = {};
  if (body.owner) customerFilter.owner = cleanText(body.owner, 120);
  if (body.product) {
    const escaped = String(body.product).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const orderCustomerIds = await db
      .collection(collections.orders)
      .distinct("customerId", {
        products: {
          $elemMatch: {
            $or: [
              { sku: { $regex: escaped, $options: "i" } },
              { name: { $regex: escaped, $options: "i" } },
            ],
          },
        },
      });
    customerFilter.id = { $in: orderCustomerIds };
  }
  const customers = await db
    .collection(collections.customers)
    .find(customerFilter, {
      projection: { _id: 0, id: 1, name: 1, phone: 1, owner: 1 },
    })
    .limit(1000)
    .toArray();
  if (body.preview) return NextResponse.json({ count: customers.length });
  if (!customers.length)
    return NextResponse.json(
      { error: "Không tìm thấy khách hàng phù hợp." },
      { status: 400 },
    );
  const dueAt = new Date(body.dueAt).toISOString();
  const existing = new Set(
    (
      await db
        .collection(collections.careTasks)
        .find(
          {
            customerId: { $in: customers.map((item) => item.id) },
            dueAt,
            purpose: cleanText(body.purpose, 200),
          },
          { projection: { customerId: 1 } },
        )
        .toArray()
    ).map((item) => String(item.customerId)),
  );
  const now = Date.now();
  const documents = customers
    .filter((item) => !existing.has(String(item.id)))
    .map((customer, index) => ({
      id: `CS-${now}-${index + 1}`,
      customerId: customer.id,
      customer: customer.name,
      phone: customer.phone,
      purpose: cleanText(body.purpose, 200),
      owner:
        body.assignToCustomerOwner === false
          ? cleanText(body.owner || user.name, 120)
          : customer.owner,
      dueAt,
      channel: cleanText(body.channel || "Gọi điện", 50),
      recurrence: "none",
      status: "due",
      createdAt: new Date().toISOString(),
      bulkCreated: true,
    }));
  if (documents.length)
    await db.collection(collections.careTasks).insertMany(documents);
  await writeAudit(user, "bulk_create", "care_task", `bulk-${now}`, null, {
    count: documents.length,
    skipped: existing.size,
    product: body.product || "",
    dueAt,
  });
  return NextResponse.json(
    { created: documents.length, skipped: existing.size },
    { status: 201 },
  );
}
