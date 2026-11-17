export function monthStart(value?: string) {
  return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? `${value}-01` : undefined;
}
export function monthEnd(value?: string) {
  if (!monthStart(value)) return undefined;
  const [year, month] = value!.split("-").map(Number);
  return `${value}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
}
export function monthBounds(from?: string, to?: string) {
  const start = monthStart(from), end = monthEnd(to);
  return {
    ...(start ? { $gte: new Date(`${start}T00:00:00+07:00`).toISOString() } : {}),
    ...(end ? { $lte: new Date(`${end}T23:59:59.999+07:00`).toISOString() } : {}),
  };
}
