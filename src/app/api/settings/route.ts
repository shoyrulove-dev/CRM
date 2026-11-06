import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import {
  configStatus,
  getIntegrationConfig,
  saveIntegrationConfig,
} from "@/lib/integration-config";
async function allowed() {
  return (await getCurrentUser())?.role === "admin";
}
export async function GET() {
  if (!(await allowed()))
    return NextResponse.json(
      { error: "Bạn không có quyền xem cài đặt." },
      { status: 403 },
    );
  const c = await getIntegrationConfig();
  return NextResponse.json({
    data: {
      haravanShop: c.haravanShop || "",
      r2Endpoint: c.r2Endpoint || "",
      r2Bucket: c.r2Bucket || "",
      r2AccessKeyId: c.r2AccessKeyId ? `••••${c.r2AccessKeyId.slice(-4)}` : "",
      hasHaravanToken: Boolean(c.haravanAccessToken),
      hasWebhookSecret: Boolean(c.haravanWebhookSecret),
      hasR2Secret: Boolean(c.r2SecretAccessKey),
      status: configStatus(c),
    },
  });
}
export async function PATCH(request: NextRequest) {
  if (!(await allowed()))
    return NextResponse.json(
      { error: "Bạn không có quyền cập nhật cài đặt." },
      { status: 403 },
    );
  const body = await request.json().catch(() => null);
  if (!body)
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ." },
      { status: 400 },
    );
  const c = await saveIntegrationConfig(body);
  return NextResponse.json({ ok: true, status: configStatus(c) });
}
