import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import { getIntegrationConfig } from "@/lib/integration-config";
import { sendEmail } from "@/lib/email";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const message = "Nếu email khớp với tài khoản đang hoạt động, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra cả thư rác.";
export async function POST(request: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: "Dịch vụ khôi phục đang tạm gián đoạn." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const db = await getDatabase();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Atomic per-IP windows prevent concurrent requests bypassing the limit.
  const window = Math.floor(Date.now() / 900000);
  const limits = db.collection<{ _id: string; count: number; expiresAt: Date }>("password_reset_limits");
  await limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const limit = await limits.findOneAndUpdate({ _id: `${digest(ip)}:${window}` }, {
    $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 900000) },
  }, { upsert: true, returnDocument: "after" });
  if (Number(limit?.count) > 20) return NextResponse.json({ error: "Bạn đã thử nhiều lần. Vui lòng thử lại sau 15 phút." }, { status: 429 });
  if (typeof body.token === "string" && body.token) {
    if (!/^[a-f0-9]{64}$/.test(body.token)) return NextResponse.json({ error: "Liên kết không hợp lệ hoặc đã hết hạn." }, { status: 400 });
    if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) return NextResponse.json({ error: "Mật khẩu cần từ 8 đến 128 ký tự." }, { status: 400 });
    const passwordHash = await hash(body.password, 10);
    // Consume the token and change the password in the same atomic update.
    const account = await db.collection(collections.users).findOneAndUpdate({ resetTokenHash: digest(body.token), resetExpiresAt: { $gt: new Date() }, active: true, archivedAt: { $exists: false } }, {
      $set: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date().toISOString() },
      $inc: { sessionVersion: 1 }, $unset: { resetTokenHash: "", resetExpiresAt: "" },
    });
    if (!account) return NextResponse.json({ error: "Liên kết không hợp lệ, đã dùng hoặc đã hết hạn." }, { status: 400 });
    await db.collection(collections.loginAttempts).deleteMany({ email: account.email });
    return NextResponse.json({ ok: true, message: "Đã đổi mật khẩu. Bạn có thể đăng nhập bằng mật khẩu mới." });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Vui lòng nhập email hợp lệ." }, { status: 400 });
  const config = await getIntegrationConfig();
  if (!config.resendApiKey || !config.emailFrom) return NextResponse.json({ error: "Email khôi phục chưa được cấu hình. Vui lòng liên hệ quản trị viên." }, { status: 503 });
  const token = randomBytes(32).toString("hex"), tokenHash = digest(token);
  const account = await db.collection(collections.users).findOneAndUpdate({ email, active: true, archivedAt: { $exists: false }, $or: [{ resetRequestedAt: { $exists: false } }, { resetRequestedAt: { $lt: new Date(Date.now() - 300000) } }] }, {
    $set: { resetTokenHash: tokenHash, resetExpiresAt: new Date(Date.now() + 1800000), resetRequestedAt: new Date() },
  });
  if (account) {
    const base = process.env.APP_URL || "https://crm.nichieiasia.com";
    try {
      await sendEmail(email, "Đặt lại mật khẩu Nichiei CRM", `Bạn vừa yêu cầu đặt lại mật khẩu Nichiei CRM.\n\nMở liên kết sau trong 30 phút:\n${base}/reset-password#${token}\n\nLiên kết chỉ dùng một lần. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.`, `crm-reset/${tokenHash}`);
    } catch {
      await db.collection(collections.users).updateOne({ id: account.id, resetTokenHash: tokenHash }, { $unset: { resetTokenHash: "", resetExpiresAt: "", resetRequestedAt: "" } });
      // Do not reveal whether an account exists when the provider fails.
      console.error("CRM_PASSWORD_RESET_EMAIL_FAILED");
    }
  }
  return NextResponse.json({ ok: true, message });
}
