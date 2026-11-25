import "server-only";
import { getDatabase, hasDatabase } from "./mongodb";
import type { PurchaseBaseline } from "./customer-report-metrics";

export const purchaseHistoryBatches = "purchase_history_batches";
export const purchaseHistoryRows = "purchase_history_baselines";
export function mergePurchaseBaseline(result: Map<string, PurchaseBaseline>, customerId: string, row: PurchaseBaseline) {
  const current = result.get(customerId);
  if (!current || row.day < current.day) result.set(customerId, row);
  else if (row.day === current.day) {
    const sameOrder = current.code && current.code === row.code;
    result.set(customerId, { day: row.day, code: sameOrder ? row.code : "",
      skus: sameOrder && current.skus.length && row.skus.length ? [...new Set([...current.skus, ...row.skus])] : [] });
  }
}

export async function loadPurchaseHistory(customerIds: string[]) {
  const result = new Map<string, PurchaseBaseline>();
  if (!hasDatabase() || !customerIds.length) return result;
  const db = await getDatabase();
  const batches = await db.collection(purchaseHistoryBatches).distinct("id", { status: "approved" });
  if (!batches.length) return result;
  const rows = db.collection<PurchaseBaseline & { batchId: string; customerId: string }>(purchaseHistoryRows)
    .find({ batchId: { $in: batches }, customerId: { $in: [...new Set(customerIds)] } });
  for await (const row of rows) mergePurchaseBaseline(result, row.customerId, row);
  return result;
}
