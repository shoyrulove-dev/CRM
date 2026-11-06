import { NextRequest, NextResponse } from "next/server";
import { collections, listCareTasks } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";

export async function GET() { const user=await getCurrentUser(); if(!hasPermission(user,"care")) return NextResponse.json({error:"Bạn không có quyền xem lịch chăm sóc."},{status:403}); return NextResponse.json({ data: await listCareTasks(user), source: hasDatabase() ? "mongodb" : "demo" }); }
export async function POST(request: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body?.customer || !body?.purpose || (!body?.dueAt&&!body?.baseDate)) return NextResponse.json({ error: "Vui lòng chọn khách hàng và ngày chăm sóc." }, { status: 400 });
  const user=await getCurrentUser();let dueAt=body.dueAt;
  if(!hasPermission(user,"care")) return NextResponse.json({error:"Bạn không có quyền tạo lịch chăm sóc."},{status:403});
  if(!dueAt&&body.baseDate){const date=new Date(`${body.baseDate}T09:00:00+07:00`);date.setDate(date.getDate()+Number(body.offsetDays||0));dueAt=date.toISOString();}
  const document = { id: `CS-${Date.now().toString().slice(-6)}`, customerId: body.customerId || "", customer: body.customer, phone: body.phone || "", purpose: body.purpose, owner: user?.role==="admin"?(body.owner||user.name):(user?.name||"Chưa phân công"), dueAt, offsetDays:Number(body.offsetDays||0)||undefined, channel: body.channel || "Gọi điện", recurrence: body.recurrence || "none", status: "due", createdAt: new Date().toISOString() };
  await (await getDatabase()).collection(collections.careTasks).insertOne(document);
  return NextResponse.json({ data: document }, { status: 201 });
}
