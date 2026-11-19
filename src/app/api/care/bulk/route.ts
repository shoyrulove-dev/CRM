import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll } from "@/lib/session";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import { cleanText, hasBrokenText, validDate } from "@/lib/validation";
import { recurrenceOptions, type Recurrence } from "@/lib/care-recurrence";
import { PROGRAMS, programCustomers, processCareProgram, type CareProgram } from "@/lib/care-programs";
import { writeAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canSeeAll(user)) return NextResponse.json({ error: "Chỉ quản trị viên được tạo lịch hàng loạt." }, { status: 403 });
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || hasBrokenText([body.purpose, body.owner, body.channel])) return NextResponse.json({ error: "Nội dung không hợp lệ." }, { status: 400 });
  const db = await getDatabase();
  if (body.programId) {
    if (typeof body.programId !== "string") return NextResponse.json({ error: "Mã chương trình không hợp lệ." }, { status: 400 });
    return NextResponse.json(await processCareProgram(body.programId));
  }
  if (!cleanText(body.purpose, 200) || !validDate(body.dueAt)) return NextResponse.json({ error: "Nhập nội dung và ngày giờ hợp lệ." }, { status: 400 });
  const owner = cleanText(body.owner, 120), filterOwner = cleanText(body.filterOwner, 120), product = cleanText(body.product, 200);
  if (body.assignToCustomerOwner === false && !await db.collection(collections.users).findOne({ name: owner, active: true }))
    return NextResponse.json({ error: "Chọn nhân viên nhận việc đang hoạt động." }, { status: 400 });
  if (body.endDate && (!validDate(body.endDate) || body.endDate < String(body.dueAt).slice(0, 10))) return NextResponse.json({ error: "Ngày kết thúc không trước ngày bắt đầu." }, { status: 400 });
  const customers = await programCustomers({ filterOwner, product });
  const unassigned = customers.filter(c => !c.owner || c.owner === "Chưa phân công").length;
  if (body.preview) return NextResponse.json({ count: customers.length, unassigned });
  if (!customers.length) return NextResponse.json({ error: "Không có khách phù hợp." }, { status: 400 });
  const requestKey = typeof body.requestKey === "string" ? body.requestKey : randomUUID();
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(requestKey)) return NextResponse.json({ error: "Mã yêu cầu không hợp lệ." }, { status: 400 });
  const id = `CP-${user!.id}-${requestKey}`;
  const dueAt = new Date(body.dueAt).toISOString();
  const program: CareProgram = { id, purpose: cleanText(body.purpose, 200), channel: cleanText(body.channel || "Gọi điện", 50), owner,
    assignToCustomerOwner: body.assignToCustomerOwner !== false, filterOwner, product, customerIds: customers.map(c => String(c.id)), targetCount: customers.length,
    nextDueAt: dueAt, recurrence: (Object.keys(recurrenceOptions).includes(body.recurrence) ? body.recurrence : "none") as Recurrence,
    intervalDays: Math.min(3650, Math.max(1, Math.floor(Number(body.intervalDays) || 7))), anchorDay: new Date(Date.parse(dueAt) + 7 * 3600000).getUTCDate(),
    endDate: body.endDate || "", status: "active", cursor: 0, created: 0, skipped: 0, occurrence: 1, createdAt: new Date().toISOString(), createdBy: user!.id };
  await db.collection(PROGRAMS).createIndex({ id: 1 }, { unique: true });
  await db.collection(PROGRAMS).updateOne({ id }, { $setOnInsert: program }, { upsert: true });
  await writeAudit(user, "create", "care_program", id, null, { targetCount: customers.length, purpose: program.purpose });
  const result = await processCareProgram(id);
  return NextResponse.json({ ...result, programId: id, count: customers.length, unassigned }, { status: 201 });
}
