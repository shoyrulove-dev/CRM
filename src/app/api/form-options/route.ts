import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { listProductCatalog } from "@/lib/data-store";
import { listUsers } from "@/lib/users";
import { getFormCustomers, getFormCustomerOrders } from "@/lib/form-options";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const kind = request.nextUrl.searchParams.get("kind") === "tickets" ? "tickets" : "care";
  if (!user || !hasPermission(user, kind)) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const customerId = request.nextUrl.searchParams.get("customerId");
  if (customerId) {
    const orders = await getFormCustomerOrders(user, customerId.slice(0, 100));
    return orders === null ? NextResponse.json({ error: "Khách hàng không thuộc phạm vi truy cập." }, { status: 404 })
      : NextResponse.json({ orders }, { headers: { "cache-control": "private, no-store" } });
  }
  const [customers, users, products] = await Promise.all([getFormCustomers(user), listUsers(), kind === "tickets" ? listProductCatalog() : Promise.resolve([])]);
  return NextResponse.json({ customers, orders: [], loadOrdersOnDemand: true, products,
    employees: users.filter((item) => item.active && (["admin", "super_admin"].includes(user.role) || item.id === user.id)).map(({ id, name }) => ({ id, name })) }, { headers: { "cache-control": "private, no-store" } });
}
