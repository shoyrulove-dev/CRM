export const recurrenceOptions = { none: "Không lặp", weekly: "Hàng tuần", monthly: "Hàng tháng", quarterly: "Hàng quý", yearly: "Hàng năm", custom: "Theo số ngày" };
export type Recurrence = keyof typeof recurrenceOptions;
export function nextCareDate(value: string, recurrence: string, intervalDays = 1, anchorDay?: number): string | null {
  if (recurrence === "none") return null;
  const date = new Date(new Date(value).getTime() + 7 * 3600000);
  if (!Number.isFinite(date.getTime())) return null;
  if (recurrence === "weekly" || recurrence === "custom") date.setUTCDate(date.getUTCDate() + (recurrence === "weekly" ? 7 : intervalDays));
  else {
    const months = recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : recurrence === "yearly" ? 12 : 0;
    if (!months) return null;
    const day = anchorDay || date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, last));
  }
  return new Date(date.getTime() - 7 * 3600000).toISOString();
}
