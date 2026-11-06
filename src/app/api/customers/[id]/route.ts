import { NextRequest, NextResponse } from "next/server";
import { collections, getCustomerProfile } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const profile = await getCustomerProfile(id);
  if (!profile.customer) return NextResponse.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
  return NextResponse.json(profile);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng. Vui lòng liên hệ quản trị viên." }, { status: 503 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const allowed = ["name", "phone", "owner", "segment", "healthGoal", "nextCare", "status"];
  const update = Object.fromEntries(Object.entries(body || {}).filter(([key]) => allowed.includes(key)));
  if (!Object.keys(update).length) return NextResponse.json({ error: "Không có thông tin hợp lệ để cập nhật." }, { status: 400 });
  const result = await (await getDatabase()).collection(collections.customers).findOneAndUpdate(
    { id }, { $set: { ...update, updatedAt: new Date().toISOString() } }, { returnDocument: "after", projection: { _id: 0 } },
  );
  return result ? NextResponse.json({ data: result }) : NextResponse.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
}
