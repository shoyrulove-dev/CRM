export const validDate = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(new Date(value).getTime());
export const validPhone = (value: unknown) =>
  typeof value === "string" && /^[+\d][\d\s.-]{7,14}$/.test(value.trim());
export const cleanText = (value: unknown, max = 500) =>
  String(value || "")
    .trim()
    .slice(0, max);

// These sequences result from decoding UTF-8 with the wrong encoding. Reject
// damaged input instead of persisting characters whose accents are lost.
export function hasBrokenText(value: unknown): boolean {
  if (typeof value === "string")
    return /\uFFFD|[\u00C3\u00C4\u00C6][\u0080-\u00BF]|\u00E1[\u00BA\u00BB]|\u00E2[\u0080\u20AC]|\u00EF\u00BF\u00BD/.test(value);
  if (Array.isArray(value)) return value.some(hasBrokenText);
  return false;
}
export const oneOf = <T extends string>(
  value: unknown,
  values: readonly T[],
): value is T => typeof value === "string" && values.includes(value as T);
