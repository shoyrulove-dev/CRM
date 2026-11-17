export function monthStart(value?: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : undefined;
}
export function monthEnd(value?: string) {
  if (!monthStart(value)) return undefined;
  const [year, month] = value!.split("-").map(Number);
  return `${value}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
}
export function validDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}
export function dayBounds(value?: string) {
  const day = validDay(value);
  return day ? { $gte: new Date(`${day}T00:00:00+07:00`).toISOString(), $lte: new Date(`${day}T23:59:59.999+07:00`).toISOString() } : undefined;
}
export function monthBounds(from?: string, to?: string) {
  const start = monthStart(from), end = monthEnd(to);
  return {
    ...(start ? { $gte: new Date(`${start}T00:00:00+07:00`).toISOString() } : {}),
    ...(end ? { $lte: new Date(`${end}T23:59:59.999+07:00`).toISOString() } : {}),
  };
}
