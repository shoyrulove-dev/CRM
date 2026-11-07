import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { collections } from "@/lib/data-store";
import { getDatabase } from "@/lib/mongodb";
const valid = ["customers", "care", "tickets", "reports"];
async function admin() {
  return (await getCurrentUser())?.role === "admin";
}
export async function GET() {
  if (!(await admin()))
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const data = await (
    await getDatabase()
  )
    .collection(collections.permissionGroups)
    .find({}, { projection: { _id: 0 } })
    .sort({ name: 1 })
    .toArray();
  return NextResponse.json({ data });
}
export async function POST(r: NextRequest) {
  if (!(await admin()))
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const b = await r.json().catch(() => null);
  if (!b?.name)
    return NextResponse.json(
      { error: "Vui lòng nhập tên nhóm." },
      { status: 400 },
    );
  const d = {
    id: `NQ-${Date.now().toString().slice(-6)}`,
    name: String(b.name).trim(),
    permissions: (b.permissions || []).filter((x: string) => valid.includes(x)),
    createdAt: new Date().toISOString(),
  };
  await (await getDatabase())
    .collection(collections.permissionGroups)
    .insertOne(d);
  return NextResponse.json({ data: d }, { status: 201 });
}
