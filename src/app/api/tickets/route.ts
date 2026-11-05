import { NextRequest, NextResponse } from "next/server";
import { collections, listTickets } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function GET() { return NextResponse.json({ data: await listTickets(), source: hasDatabase() ? "mongodb" : "demo" }); }
export async function POST(request: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: "MongoDB chưa được cấu hình." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body?.customerId || !body?.title) return NextResponse.json({ error: "Khách hàng và nội dung là bắt buộc." }, { status: 400 });
  const document = { id: `YC-${Date.now().toString().slice(-6)}`, customerId: body.customerId, customer: body.customer || "", title: body.title, description: body.description || "", priority: body.priority || "Bình thường", status: "Mới", owner: body.owner || "Chưa phân công", createdAt: new Date().toISOString() };
  await (await getDatabase()).collection(collections.tickets).insertOne(document);
  return NextResponse.json({ data: document }, { status: 201 });
}
