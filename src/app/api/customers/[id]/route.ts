import { NextResponse } from "next/server";
import { getCustomerProfile } from "@/lib/data-store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const profile = await getCustomerProfile(id);
  if (!profile.customer) return NextResponse.json({ error: "Không tìm thấy khách hàng." }, { status: 404 });
  return NextResponse.json(profile);
}
