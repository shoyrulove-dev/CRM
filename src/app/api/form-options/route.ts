import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { getReportData, listProductCatalog } from "@/lib/data-store";
import { listUsers } from "@/lib/users";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const kind = request.nextUrl.searchParams.get("kind") === "tickets" ? "tickets" : "care";
  if (!user || !hasPermission(user, kind)) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const [data, users, products] = await Promise.all([getReportData(user), listUsers(), kind === "tickets" ? listProductCatalog() : Promise.resolve([])]);
  return NextResponse.json({ customers: data.customers, orders: data.orders, products,
    employees: users.filter((item) => item.active && (["admin", "super_admin"].includes(user.role) || item.id === user.id)).map(({ id, name }) => ({ id, name })) }, { headers: { "cache-control": "private, no-store" } });
}
