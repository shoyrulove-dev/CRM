export const haravanCustomerFields = { name: "Tên hiển thị", phone: "SĐT liên hệ", birthDate: "Ngày sinh" } as const;
export type HaravanCustomerField = keyof typeof haravanCustomerFields;
export type HaravanCustomerSource = Record<HaravanCustomerField, string>;
export type HaravanCustomerCorrections = Partial<Record<HaravanCustomerField, {
  value: string;
  sourceAtEdit: string;
  reason: string;
  editor: string;
  editedAt: string;
}>>;

export function normalizeContactPhone(value: string) {
  if (!/^[\d+ .()-]+$/.test(value)) return "";
  return value.replace(/\D/g, "").replace(/^84(?=\d{9}$)/, "0");
}
