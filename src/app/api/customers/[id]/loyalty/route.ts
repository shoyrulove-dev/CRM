import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { canSeeAll, hasPermission } from "@/lib/session";
import { getDatabase } from "@/lib/mongodb";
import { getIntegrationConfig } from "@/lib/integration-config";
import { fetchHaravanLoyalty } from "@/lib/haravan-loyalty-api";

export async function POST(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(), { id } = await context.params;
  if (!hasPermission(user, "customers")) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const db = await getDatabase(), col = db.collection("customers");
  const customer = await col.findOne({ id, ...(canSeeAll(user) ? {} : { owner: user!.name }) });
  if (!customer) return NextResponse.json({ error: "Không tìm thấy khách." }, { status: 404 });
  if (!/^\d+$/.test(String(customer.haravanId || ""))) return NextResponse.json({ error: "Khách chưa có mã Haravan hợp lệ." }, { status: 400 });
  const token = (await getIntegrationConfig()).haravanAccessToken;
  if (!token) return NextResponse.json({ error: "Chưa có token Haravan." }, { status: 503 });
  const now = new Date();
  const lock = await col.findOneAndUpdate({ _id: customer._id, $or: [{ loyaltyManualRetryAt: { $exists: false } }, { loyaltyManualRetryAt: { $lte: now.toISOString() } }] },
    { $set: { loyaltyManualRetryAt: new Date(now.getTime() + 60000).toISOString() } }, { returnDocument: "after" });
  if (!lock) return NextResponse.json({ error: "Vui lòng đợi một phút trước khi cập nhật lại." }, { status: 429 });
  try {
    const fields = await fetchHaravanLoyalty(token, String(customer.haravanId), AbortSignal.timeout(25000));
    await col.updateOne({ _id: customer._id, haravanId: customer.haravanId }, { $set: { ...fields, loyaltySyncedAt: new Date().toISOString() }, $unset: { loyaltySyncError: "" } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Haravan chưa trả được hạng/điểm. Dữ liệu đã lưu vẫn được giữ nguyên; vui lòng thử lại sau." }, { status: 502 }); }
}
