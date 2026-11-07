import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";
import "./refinements.css";
import { getCurrentUser } from "@/lib/current-user";

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
  const user = await getCurrentUser();
  return (
    <html lang="vi">
      <body className={font.className}>
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
