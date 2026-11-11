import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./refinements.css";
import { getCurrentUser } from "@/lib/current-user";
import { configStatus, getIntegrationConfig } from "@/lib/integration-config";
import { getHaravanSyncStatus } from "@/lib/haravan-sync";

const font = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nichiei CRM",
  description: "Hệ thống chăm sóc khách hàng Nichiei",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [user, integration, sync] = await Promise.all([
    getCurrentUser(),
    getIntegrationConfig(),
    getHaravanSyncStatus(),
  ]);
  const haravanReady = configStatus(integration).haravan;
  return (
    <html lang="vi">
      <body className={font.className}>
        <AppShell
          user={user}
          commerceStatus={{ ready: haravanReady, lastSyncAt: sync?.lastSuccessAt || "" }}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
