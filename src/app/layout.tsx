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

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://nichiei-crm.vercel.app",
);

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Nichiei CRM",
    template: "%s | Nichiei CRM",
  },
  description: "Hệ thống chăm sóc khách hàng Nichiei",
  applicationName: "Nichiei CRM",
  authors: [{ name: "Nichiei Asia" }],
  creator: "Nichiei Asia",
  publisher: "Nichiei Asia",
  category: "business",
  keywords: ["Nichiei Asia", "CRM", "chăm sóc khách hàng", "quản lý khách hàng"],
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/app-icon-192.png",
    apple: [{ url: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "/",
    siteName: "Nichiei CRM",
    title: "Nichiei CRM",
    description: "Hệ thống chăm sóc và quản lý khách hàng của Nichiei Asia",
    images: [{ url: "/icons/app-icon-512.png", width: 512, height: 512, alt: "Nichiei Asia" }],
  },
  twitter: {
    card: "summary",
    title: "Nichiei CRM",
    description: "Hệ thống chăm sóc và quản lý khách hàng của Nichiei Asia",
    images: ["/icons/app-icon-512.png"],
  },
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Nichiei CRM" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
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
