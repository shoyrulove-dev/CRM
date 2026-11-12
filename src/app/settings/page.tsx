import { redirect } from "next/navigation";
import { IntegrationSettings } from "@/components/integration-settings";
import { getCurrentUser } from "@/lib/current-user";
import { configStatus, getIntegrationConfig } from "@/lib/integration-config";
import { hasDatabase } from "@/lib/mongodb";
import { getHaravanSyncStatus } from "@/lib/haravan-sync";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  if ((await getCurrentUser())?.role !== "admin") redirect("/");
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const c = await getIntegrationConfig(),
    status = configStatus(c),
    initial = {
      webhookUrl: `${process.env.APP_URL || `${protocol}://${host}`}/api/webhooks/haravan`,
      haravanShop: c.haravanShop || "",
      r2Endpoint: c.r2Endpoint || "",
      r2Bucket: c.r2Bucket || "",
      r2AccessKeyId: c.r2AccessKeyId ? `••••${c.r2AccessKeyId.slice(-4)}` : "",
      hasHaravanToken: Boolean(c.haravanAccessToken),
      hasWebhookSecret: Boolean(c.haravanWebhookSecret),
      hasR2Secret: Boolean(c.r2SecretAccessKey),
      status,
      sync: await getHaravanSyncStatus(),
    };
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">CẤU HÌNH HỆ THỐNG</p>
          <h1>Cài đặt kết nối</h1>
          <p>Quản lý nơi lưu dữ liệu, Haravan và sao lưu Cloudflare R2.</p>
        </div>
      </div>
      <IntegrationSettings initial={initial} dataReady={hasDatabase()} />
    </>
  );
}
