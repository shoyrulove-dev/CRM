import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll } from "@/lib/session";
import { getDatabase } from "@/lib/mongodb";
import { PROGRAMS } from "@/lib/care-programs";
import { cleanText, hasBrokenText, validDate } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { recurrenceOptions } from "@/lib/care-recurrence";
import { defaultCareAutomation } from "@/lib/care-automation-defaults";

export async function GET(request: NextRequest) {
  if (!canSeeAll(await getCurrentUser())) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const db = await getDatabase(), page = Math.max(1, Math.floor(Number(request.nextUrl.searchParams.get("page")) || 1));
  const total = await db.collection(PROGRAMS).countDocuments({});
  const selected = Math.min(page, Math.max(1, Math.ceil(total / 10)));
  const items = await db.collection(PROGRAMS).find({}, { projection: { _id: 0, customerIds: 0, leaseOwner: 0 } }).sort({ createdAt: -1 }).skip((selected - 1) * 10).limit(10).toArray();
  return NextResponse.json({ items, total, page: selected, pages: Math.max(1, Math.ceil(total / 10)), automation: { ...defaultCareAutomation, ...await db.collection("settings").findOne({ id: "care_automation" }, { projection: { _id: 0 } }) } });
}
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!canSeeAll(user)) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const body = await request.json().catch(() => null), db = await getDatabase();
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Thiếu mã chương trình." }, { status: 400 });
  if (body.id === "care_automation") {
    const rules = body.orderRules;
    if (!Array.isArray(rules) || rules.length > 20 || rules.some(r => !r || !Number.isInteger(r.offset) || r.offset < 0 || r.offset > 3650 || !cleanText(r.purpose, 200) || hasBrokenText(r.purpose))) return NextResponse.json({ error: "Nội dung hoặc số ngày nhắc không hợp lệ." }, { status: 400 });
    const settings = { orderRules: rules.map(r => ({ offset: r.offset, purpose: cleanText(r.purpose, 200), channel: cleanText(r.channel || "Gọi điện", 50) })), birthdays: body.birthdays === true, holidays: body.holidays === true, orders: body.orders === true, activeFrom: validDate(body.activeFrom) ? new Date(body.activeFrom).toISOString() : new Date().toISOString() };
    await db.collection("settings").updateOne({ id: body.id }, { $set: settings }, { upsert: true });
    await writeAudit(user, "update", "care_automation", body.id, null, settings);
    return NextResponse.json({ ok: true });
  }
  const existing = await db.collection(PROGRAMS).findOne({ id: body.id });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy chương trình." }, { status: 404 });
  if (existing.leaseUntil && new Date(existing.leaseUntil) > new Date()) return NextResponse.json({ error: "Đang xử lý một lô. Vui lòng đợi rồi thử lại." }, { status: 409 });
  const update: Record<string, unknown> = {};
  if (["active", "paused", "ended"].includes(body.status)) update.status = body.status;
  if (body.purpose !== undefined) { if (!cleanText(body.purpose, 200) || hasBrokenText(body.purpose)) return NextResponse.json({ error: "Nội dung không hợp lệ." }, { status: 400 }); update.purpose = cleanText(body.purpose, 200); }
  if (typeof body.recurrence === "string" && Object.hasOwn(recurrenceOptions, body.recurrence)) update.recurrence = body.recurrence;
  if (body.intervalDays !== undefined) update.intervalDays = Math.min(3650, Math.max(1, Math.floor(Number(body.intervalDays) || 7)));
  if (body.endDate !== undefined) { if (body.endDate && !validDate(body.endDate)) return NextResponse.json({ error: "Ngày kết thúc không hợp lệ." }, { status: 400 }); update.endDate = body.endDate; }
  if (body.nextDueAt !== undefined) { if (!validDate(body.nextDueAt) || (existing.cursor > 0 && existing.cursor < existing.targetCount)) return NextResponse.json({ error: "Không đổi ngày trong lúc một lượt chưa tạo đủ lịch." }, { status: 400 }); update.nextDueAt = new Date(body.nextDueAt).toISOString(); }
  if (!Object.keys(update).length) return NextResponse.json({ error: "Không có thay đổi hợp lệ." }, { status: 400 });
  if (existing.cursor > 0 && existing.cursor < existing.targetCount && (update.purpose || update.recurrence)) return NextResponse.json({ error: "Hãy chờ lượt hiện tại tạo đủ lịch trước khi sửa nội dung." }, { status: 409 });
  await db.collection(PROGRAMS).updateOne({ id: body.id }, { $set: update });
  await writeAudit(user, "update", "care_program", body.id, existing, update);
  return NextResponse.json({ ok: true });
}
