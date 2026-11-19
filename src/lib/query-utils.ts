export function escapeSearch(value: string) {
  return value.slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
