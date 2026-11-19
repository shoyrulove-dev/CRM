import { validDay } from "./month-range";
export function reportDay(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * 3600_000).toISOString().slice(0, 10) : "";
}
export function reportInRange(value: string, from?: string, to?: string) {
  const day = reportDay(value);
  return !!day && (!from || day >= from) && (!to || day <= to);
}
export function reportPeriod(from?: string, to?: string, now = new Date()) {
  const today = reportDay(now.toISOString());
  const startDay = from === undefined || from === "" ? today.slice(0, 7) + "-01" : validDay(from);
  const endDay = to === undefined || to === "" ? today : validDay(to);
  if (!startDay || !endDay || startDay > endDay) return null;
  const start = Date.parse(startDay), end = Date.parse(endDay);
  const days = Math.round((end - start) / 86400_000) + 1;
  return { from: startDay, to: endDay, previousFrom: new Date(start - days * 86400_000).toISOString().slice(0, 10), previousTo: new Date(start - 86400_000).toISOString().slice(0, 10) };
}
