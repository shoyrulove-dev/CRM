import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { verifyHaravanWebhook } from "@/lib/haravan";
import { getDatabase, hasDatabase } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-haravan-hmacsha256");
  if (!await verifyHaravanWebhook(rawBody, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const topic = request.headers.get("x-haravan-topic") || String(payload.topic || "unknown");
  const externalId = String(payload.id || payload.order_id || payload.customer_id || "");
  await (await getDatabase()).collection(collections.syncEvents).updateOne(
    { topic, externalId },
    { $setOnInsert: { topic, externalId, payload, receivedAt: new Date(), status: "pending" } },
    { upsert: true },
  );
  return NextResponse.json({ ok: true });
}
