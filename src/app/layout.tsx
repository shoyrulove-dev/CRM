import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./refinements.css";
import { getCurrentUser } from "@/lib/current-user";
import { configStatus, getIntegrationConfig } from "@/lib/integration-config";
import { getHaravanSyncStatus } from "@/lib/haravan-sync";

const font = Montserrat({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nichiei",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nichiei CRM",
  description: "Hệ thống chăm sóc khách hàng Nichiei",
  applicationName: "Nichiei CRM",
  icons: {
    icon: "/brand/nichiei-asia-logo.png",
    apple: "/brand/nichiei-asia-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbd665",
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
      <body className={font.variable}>
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
