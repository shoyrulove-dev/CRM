import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { getIntegrationConfig, saveIntegrationConfig } from "@/lib/integration-config";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  if ((await getCurrentUser())?.role !== "super_admin") return NextResponse.json({ error: "Bạn không có quyền cấu hình email." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !["save", "test"].includes(body.action)) return NextResponse.json({ error: "Yêu cầu không hợp lệ." }, { status: 400 });
  const current = await getIntegrationConfig();
  if (body.action === "test") {
    const to = String(body.testTo || current.emailTestTo || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "Email nhận thử không hợp lệ." }, { status: 400 });
    try { await sendEmail(to, "Nichiei CRM — Kiểm tra gửi email", "Email thử từ Nichiei CRM. Cấu hình gửi email đã hoạt động. Bạn có thể dùng chức năng quên mật khẩu với email của tài khoản."); return NextResponse.json({ ok: true, message: "Đã gửi email thử. Vui lòng kiểm tra hộp thư." }); }
    catch { return NextResponse.json({ error: "Chưa gửi được email. Kiểm tra API key và địa chỉ gửi đã xác minh trong Resend." }, { status: 503 }); }
  }
  const from = String(body.from || "").trim(), apiKey = String(body.apiKey || "").trim();
  if (!/^[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+$/.test(from)) return NextResponse.json({ error: "Địa chỉ email gửi không hợp lệ." }, { status: 400 });
  if (apiKey && !/^re_[\w-]+$/.test(apiKey)) return NextResponse.json({ error: "API key Resend không hợp lệ." }, { status: 400 });
  if (!apiKey && !current.resendApiKey) return NextResponse.json({ error: "Vui lòng nhập API key Resend." }, { status: 400 });
  await saveIntegrationConfig({ resendApiKey: apiKey || undefined, emailFrom: from, emailTestTo: String(body.testTo || "").trim() });
  return NextResponse.json({ ok: true, message: "Đã lưu cấu hình email." });
}
