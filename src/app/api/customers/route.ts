import { NextRequest, NextResponse } from "next/server";
import { listCustomers, collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function GET(request: NextRequest) {
  const data = await listCustomers(request.nextUrl.searchParams.get("q") || undefined);
  return NextResponse.json({ data, source: hasDatabase() ? "mongodb" : "demo", total: data.length });
}

export async function POST(request: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body?.name || !body?.phone) return NextResponse.json({ error: "Tên và số điện thoại là bắt buộc." }, { status: 400 });
  const db = await getDatabase();
  const duplicate = await db.collection(collections.customers).findOne({ phone: body.phone });
  if (duplicate) return NextResponse.json({ error: "Số điện thoại đã tồn tại." }, { status: 409 });
  const document = { id: `KH-${Date.now().toString().slice(-6)}`, name: String(body.name), phone: String(body.phone), owner: body.owner || "Chưa phân công", segment: body.segment || "Khách mới", orders: 0, revenue: 0, lastOrder: "—", nextCare: body.nextCare || "—", status: "due", healthGoal: body.healthGoal || "Chưa xác định", createdAt: new Date().toISOString() };
  await db.collection(collections.customers).insertOne(document);
  return NextResponse.json({ data: document }, { status: 201 });
}
