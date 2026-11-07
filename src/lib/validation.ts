export const validDate = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(new Date(value).getTime());
export const validPhone = (value: unknown) =>
  typeof value === "string" && /^[+\d][\d\s.-]{7,14}$/.test(value.trim());
export const cleanText = (value: unknown, max = 500) =>
  String(value || "")
    .trim()
    .slice(0, max);
export const oneOf = <T extends string>(
  value: unknown,
  values: readonly T[],
): value is T => typeof value === "string" && values.includes(value as T);
