import "server-only";
import { randomUUID } from "node:crypto";
import { collections } from "./data-store";
import { getIntegrationConfig } from "./integration-config";
import { getDatabase, hasDatabase } from "./mongodb";
import { fetchHaravanLoyalty, HaravanLoyaltyHttpError } from "./haravan-loyalty-api";

const JOB = "haravan_loyalty_v2";
const BATCH_SIZE = 50;
const REFRESH_MS = 24 * 60 * 60_000;
const RETRY_MS = 60 * 60_000;
const eligible = { haravanId: { $type: "string", $regex: /^\d+$/ } };

export async function getHaravanLoyaltyStatus() {
  if (!hasDatabase()) return null;
  const db = await getDatabase();
  const customers = db.collection(collections.customers);
  const [row, total, missing, due] = await Promise.all([
    db.collection(collections.settings).findOne({ id: JOB }, { projection: { _id: 0 } }),
    customers.countDocuments(eligible),
    customers.countDocuments({ ...eligible, loyaltySyncedAt: { $exists: false } }),
    customers.countDocuments({ ...eligible, $or: [
      { loyaltyNextSyncAt: { $exists: false } },
      { loyaltyNextSyncAt: { $lte: new Date().toISOString() } },
    ] }),
  ]);
  return {
    total, missing, due,
    status: String(row?.status || "idle"),
    updated: Number(row?.updated || 0),
    failed: Number(row?.failed || 0),
    halted: Boolean(row?.halted),
    finishedAt: String(row?.finishedAt || ""),
    error: String(row?.error || ""),
  };
}

export async function syncHaravanLoyalty() {
  if (!hasDatabase()) throw new Error("Cơ sở dữ liệu chưa sẵn sàng.");
  const token = (await getIntegrationConfig()).haravanAccessToken;
  if (!token) throw new Error("Chưa lưu Token Haravan.");
  const db = await getDatabase();
  const locks = db.collection<{ _id: string; owner: string; expiresAt: Date }>(collections.jobLocks);
  const owner = randomUUID();
  const now = new Date();
  try {
    await locks.findOneAndUpdate(
      { _id: JOB, expiresAt: { $lte: now } },
      { $set: { owner, expiresAt: new Date(now.getTime() + 180_000) } },
      { upsert: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      return { ...(await getHaravanLoyaltyStatus())!, busy: true };
    throw error;
  }
  const customers = db.collection(collections.customers);
  let updated = 0;
  let failed = 0;
  let errorMessage = "";
  let halted = false;
  // Leave time for DB writes and the HTTP response before the route deadline.
  const signal = AbortSignal.timeout(70_000);
  try {
    await db.collection(collections.settings).updateOne(
      { id: JOB }, { $set: { status: "running", startedAt: now.toISOString() } }, { upsert: true },
    );
    const batch = await customers.find({ ...eligible, $or: [
      { loyaltyNextSyncAt: { $exists: false } },
      { loyaltyNextSyncAt: { $lte: now.toISOString() } },
    ] }).sort({ loyaltyNextSyncAt: 1, haravanId: 1 }).limit(BATCH_SIZE)
      .project({ _id: 1, haravanId: 1 }).toArray();
    // A single paced stream avoids a burst of 50 requests against the shop quota.
    for (const customer of batch) {
      if (signal.aborted) break;
      try {
        const fields = await fetchHaravanLoyalty(token, String(customer.haravanId), signal);
        const syncedAt = new Date();
        await customers.updateOne({ _id: customer._id, haravanId: customer.haravanId }, {
          $set: { ...fields, loyaltySyncedAt: syncedAt.toISOString(),
            loyaltyNextSyncAt: new Date(syncedAt.getTime() + REFRESH_MS).toISOString() },
          $unset: { loyaltySyncError: "" },
        });
        updated++;
      } catch (error) {
        failed++;
        errorMessage = error instanceof Error ? error.message : "Không thể đồng bộ Loyalty V2.";
        // Only operational metadata changes on failure; never erase good loyalty data.
        await customers.updateOne({ _id: customer._id }, { $set: {
          loyaltySyncError: errorMessage,
          loyaltyNextSyncAt: new Date(Date.now() + RETRY_MS).toISOString(),
        } });
        halted = error instanceof HaravanLoyaltyHttpError && [401, 403, 429].includes(error.status);
        if (signal.aborted || halted) break;
      }
      if (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await db.collection(collections.settings).updateOne({ id: JOB }, { $set: {
      status: failed ? "partial" : "success", updated, failed, halted,
      finishedAt: new Date().toISOString(), error: errorMessage,
    } });
    return { ...(await getHaravanLoyaltyStatus())!, busy: false };
  } catch (error) {
    await db.collection(collections.settings).updateOne({ id: JOB }, { $set: {
      status: "failed", updated, failed, finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Đồng bộ Loyalty thất bại.",
    } }, { upsert: true });
    throw error;
  } finally {
    await locks.deleteOne({ _id: JOB, owner });
  }
}
