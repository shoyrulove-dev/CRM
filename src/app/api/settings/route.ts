import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import {
  configStatus,
  getIntegrationConfig,
  saveIntegrationConfig,
} from "@/lib/integration-config";
import { testHaravanConnection } from "@/lib/haravan";
import { getHaravanSyncStatus, syncHaravanData } from "@/lib/haravan-sync";
import { testR2Connection } from "@/lib/r2";
export const maxDuration = 300;
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
      webhookUrl: `${process.env.APP_URL || "https://nichiei-crm.vercel.app"}/api/webhooks/haravan`,
      r2Endpoint: c.r2Endpoint || "",
      r2Bucket: c.r2Bucket || "",
      r2AccessKeyId: c.r2AccessKeyId ? `••••${c.r2AccessKeyId.slice(-4)}` : "",
      hasHaravanToken: Boolean(c.haravanAccessToken),
      hasWebhookSecret: Boolean(c.haravanWebhookSecret),
      hasR2Secret: Boolean(c.r2SecretAccessKey),
      status: configStatus(c),
      sync: await getHaravanSyncStatus(),
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

export async function POST(request: NextRequest) {
  if (!(await allowed()))
    return NextResponse.json(
      { error: "Bạn không có quyền kiểm tra kết nối." },
      { status: 403 },
    );
  const body = await request.json().catch(() => null);
  if (!body || !["testHaravan", "syncHaravan", "testR2"].includes(body.action))
    return NextResponse.json(
      { error: "Yêu cầu không hợp lệ." },
      { status: 400 },
    );
  try {
    if (body.action === "testR2")
      return NextResponse.json({ data: await testR2Connection() });
    if (body.action === "syncHaravan")
      return NextResponse.json({ data: await syncHaravanData() });
    const result = await testHaravanConnection();
    if (result.shopDomain || result.shopName)
      await saveIntegrationConfig({
        haravanShop: result.shopDomain || result.shopName,
      });
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể kiểm tra Haravan.",
      },
      { status: 400 },
    );
  }
}
