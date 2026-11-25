import type { Readable } from "node:stream";
export type HistoryCells = { date: string; phone: string; order: string; sku: string };
export function normalizePhone(value: unknown): string;
export function preview(
  file: string | Readable, sheetName: string | undefined, cutoff: string,
  onPurchase?: (row: { row: number; day: string; phone: string; order: string; sku: string }) => void,
  maxRows?: number,
  edits?: Record<string, Partial<HistoryCells>>,
  editable?: boolean,
): Promise<{ rows: number; eligible: number; invalidPhone: number; invalidDate: number; afterCutoff: number; missingOrder: number; missingSku: number; uniqueEligiblePhones: number; hasOrderColumn: boolean; hasSkuColumn: boolean; sampleIssues: { row: number; issues: string[]; values?: HistoryCells }[] }>;
