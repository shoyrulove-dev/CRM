// Kept independent of MongoDB so the provider contract can be tested offline.
export type LoyaltyFields = {
  membershipTier: string;
  loyaltyPoints: number;
  loyaltyExpiresAt: string | null;
};

export function parseHaravanLoyalty(payload: unknown, customerId: string): LoyaltyFields {
  if (!payload || typeof payload !== "object") throw new Error("Phản hồi V2 không hợp lệ.");
  const customer = (payload as { customer?: unknown }).customer;
  if (!customer || typeof customer !== "object") throw new Error("V2 không trả về customer.");
  const record = customer as Record<string, unknown>;
  if (String(record.id) !== customerId) throw new Error("Mã khách hàng V2 không khớp.");
  const membership = record.membership;
  // Do not interpret missing/null membership as zero points or erase old data.
  if (!membership || typeof membership !== "object") throw new Error("V2 chưa trả về thông tin thành viên.");
  const member = membership as Record<string, unknown>;
  const amount = member.reward_point_amount;
  if ((typeof amount !== "number" && typeof amount !== "string") ||
      (typeof amount === "string" && !amount.trim()) || !Number.isFinite(Number(amount)))
    throw new Error("Điểm thưởng V2 không hợp lệ.");
  // Haravan returns an explicit null name for customers without a tier.
  if (member.name !== null && (typeof member.name !== "string" || !member.name.trim()))
    throw new Error("Hạng thành viên V2 không hợp lệ.");
  const expiry = member.reward_expire_date;
  if (expiry !== null && expiry !== undefined &&
      (typeof expiry !== "string" || (expiry !== "" && !Number.isFinite(Date.parse(expiry)))))
    throw new Error("Ngày hết hạn điểm V2 không hợp lệ.");
  return {
    membershipTier: typeof member.name === "string" ? member.name.trim() : "",
    loyaltyPoints: Number(amount),
    loyaltyExpiresAt: typeof expiry === "string" && expiry ? expiry : null,
  };
}

export class HaravanLoyaltyHttpError extends Error {
  constructor(public readonly status: number) {
    super(`Haravan V2 trả về lỗi ${status}.`);
  }
}

export async function fetchHaravanLoyalty(
  token: string,
  customerId: string,
  signal: AbortSignal,
): Promise<LoyaltyFields> {
  if (!/^\d+$/.test(customerId)) throw new Error("Mã khách hàng Haravan không hợp lệ.");
  for (let attempt = 0; attempt < 3; attempt++) {
    signal.throwIfAborted();
    const response = await fetch(
      `https://apis.haravan.com/com/v2/customers/${encodeURIComponent(customerId)}.json`,
      {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
      },
    );
    if (response.ok) return parseHaravanLoyalty(await response.json(), customerId);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 2) throw new HaravanLoyaltyHttpError(response.status);
    const retryHeader = response.headers.get("retry-after");
    const seconds = retryHeader === null ? NaN : Number(retryHeader);
    const retryAt = retryHeader ? Date.parse(retryHeader) : NaN;
    const delay = Number.isFinite(seconds) ? seconds * 1000
      : Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : 1000 * 2 ** attempt;
    // Leave long rate-limit waits to the next batch, rather than retrying too early.
    if (delay > 10_000) throw new HaravanLoyaltyHttpError(response.status);
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, Math.max(0, delay));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }
  throw new Error("Không thể đọc Loyalty V2.");
}
