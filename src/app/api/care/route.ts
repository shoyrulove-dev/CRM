import { NextRequest, NextResponse } from "next/server";
import { collections, listCareTasks } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function GET() { return NextResponse.json({ data: await listCareTasks(), source: hasDatabase() ? "mongodb" : "demo" }); }
export async function POST(request: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: "MongoDB chưa được cấu hình." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body?.customer || !body?.purpose || !body?.dueAt) return NextResponse.json({ error: "Thiếu khách hàng, mục đích hoặc thời hạn." }, { status: 400 });
  const document = { id: `CS-${Date.now().toString().slice(-6)}`, customerId: body.customerId || "", customer: body.customer, phone: body.phone || "", purpose: body.purpose, owner: body.owner || "Chưa phân công", dueAt: body.dueAt, channel: body.channel || "Gọi điện", recurrence: body.recurrence || "none", status: "due", createdAt: new Date().toISOString() };
  await (await getDatabase()).collection(collections.careTasks).insertOne(document);
  return NextResponse.json({ data: document }, { status: 201 });
}
