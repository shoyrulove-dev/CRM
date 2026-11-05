import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHaravanWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.HARAVAN_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function fetchHaravanOrders(updatedAtMin?: string) {
  const token = process.env.HARAVAN_ACCESS_TOKEN;
  if (!token) throw new Error("HARAVAN_ACCESS_TOKEN is not configured");
  const url = new URL("https://apis.haravan.com/com/orders.json");
  url.searchParams.set("limit", "50");
  if (updatedAtMin) url.searchParams.set("updated_at_min", updatedAtMin);
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Haravan API returned ${response.status}`);
  return response.json() as Promise<{ orders?: unknown[] }>;
}
