import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

export const CARE_IMPORT_HEADERS = ["Khách hàng", "SDT", "Lần chăm", "Thời gian chăm", "Nhân viên", "Kênh chăm sóc", "Kênh mua", "Mục đích", "Liên lạc", "Kết quả", "Lý do chưa mua", "Ngày hết liệu trình", "Lệch ngày", "Nhắc đúng lúc", "Hài lòng", "Phản ứng bất thường", "Ghi chú"];
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;
export type ImportActivity = {
  occurredAt: string; dateOnly: boolean; channel: string; employee: string;
  purpose: string; contactStatus: string; result: string; purchaseChannel: string;
  noPurchaseReason: string; productEndDate: string; note: string;
  careAttempt?: number; satisfaction?: number; adverseReaction?: boolean;
  dueOffsetDays?: number; repurchaseTimely?: boolean;
};
export type ParsedCareRow = {
  row: number; name: string; phone: string; data: ImportActivity;
  errors: string[]; warnings: string[];
  original: { channel: string; careAttempt: string; dueOffsetDays: string; repurchaseTimely: string };
};
export function foldImportText(value: unknown) {
  return String(value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}
export function normalizeImportPhone(value: unknown) {
  let digits = String(value ?? "").trim().replace(/[\s().+-]/g, "");
  if (digits.startsWith("0084")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("84") && /^84\d{9,10}$/.test(digits)) digits = "0" + digits.slice(2);
  return /^0\d{9,10}$/.test(digits) ? digits : "";
}
const keyOf = (value: string) => foldImportText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
export function canonicalImportChannel(value: string) {
  const key = keyOf(value);
  return ({ goidien: "Gọi điện", dienthoai: "Gọi điện", zalo: "Zalo", nhantinzalo: "Zalo", facebook: "Facebook", nhantinfacebook: "Facebook", sms: "SMS", tructiep: "Trực tiếp" } as Record<string, string>)[key] || "";
}
export function importLocalDay(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time + 7 * 3600_000).toISOString().slice(0, 10) : "";
}
export function careImportKey(customerId: string, data: Partial<ImportActivity>) {
  const values = [customerId, importLocalDay(data.occurredAt || ""), data.employee,
    canonicalImportChannel(data.channel || "") || data.channel,
    data.purpose, data.contactStatus, data.result, data.note];
  return createHash("sha256").update(JSON.stringify(values.map(foldImportText))).digest("hex");
}

// Bound ZIP expansion before ExcelJS loads the workbook into memory; no files are extracted.
export function validateImportArchive(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_IMPORT_BYTES) throw new Error("File tối đa 2 MB.");
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0 || end + 22 > buffer.length) throw new Error("File không phải Excel .xlsx hợp lệ.");
  const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12);
  let offset = buffer.readUInt32LE(end + 16), total = 0;
  if (!count || count > 1000 || offset + size > end || buffer.readUInt16LE(end + 4) !== 0)
    throw new Error("Cấu trúc file Excel không được hỗ trợ.");
  const directoryEnd = offset + size;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > directoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("Cấu trúc file Excel bị lỗi.");
    total += buffer.readUInt32LE(offset + 24);
    if (total > 30 * 1024 * 1024 || (buffer.readUInt16LE(offset + 8) & 1))
      throw new Error("File Excel quá lớn sau giải nén hoặc đã mã hóa.");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset !== directoryEnd) throw new Error("Thư mục file Excel không hợp lệ.");
}

export function parseImportDate(value: unknown, date1904 = false): { iso: string; dateOnly: boolean } | null {
  let local: Date; let dateOnly = true;
  if (value instanceof Date) {
    local = value; dateOnly = !(local.getUTCHours() || local.getUTCMinutes() || local.getUTCSeconds());
  } else if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 1 || value > 100000 || (!date1904 && Math.floor(value) === 60)) return null;
    local = new Date((date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)) + Math.round(value * 86400_000));
    dateOnly = Number.isInteger(value);
  } else if (typeof value === "string") {
    const text = value.trim();
    if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
      const [year, month, day] = text.slice(0, 10).split("-").map(Number);
      const calendar = new Date(Date.UTC(year, month - 1, day));
      if (year < 2000 || year > 2100 || calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
      const time = Date.parse(text);
      return Number.isFinite(time) ? { iso: new Date(time).toISOString(), dateOnly: false } : null;
    }
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
      || text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) return null;
    const yearFirst = match[1].length === 4;
    const year = Number(yearFirst ? match[1] : match[3]);
    const month = Number(match[2]), day = Number(yearFirst ? match[3] : match[1]);
    const hour = Number(match[4] || 0), minute = Number(match[5] || 0), second = Number(match[6] || 0);
    local = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
    dateOnly = !match[4];
  } else return null;
  if (!Number.isFinite(local.getTime()) || local.getUTCFullYear() < 2000 || local.getUTCFullYear() > 2100) return null;
  return { iso: new Date(local.getTime() - 7 * 3600_000).toISOString(), dateOnly };
}

export async function parseCareWorkbook(buffer: Buffer): Promise<ParsedCareRow[]> {
  validateImportArchive(buffer);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
  const sheet = book.getWorksheet("Chi tiết chăm sóc") || (book.worksheets.length === 1 ? book.worksheets[0] : undefined);
  if (!sheet) throw new Error("Chọn mẫu có sheet Chi tiết chăm sóc.");
  if (sheet.rowCount > 5000 || sheet.columnCount > 100) throw new Error("File có quá nhiều dòng/cột hoặc định dạng thừa.");
  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    let key = keyOf(cell.text); if (key === "sodienthoai") key = "sdt";
    if (columns.has(key)) throw new Error(`Cột bị trùng: ${cell.text}`);
    columns.set(key, column);
  });
  for (const header of CARE_IMPORT_HEADERS)
    if (!columns.has(keyOf(header))) throw new Error(`Thiếu cột ${header}. Hãy tải file mẫu.`);
  const rows: ParsedCareRow[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const cells = CARE_IMPORT_HEADERS.map(header => row.getCell(columns.get(keyOf(header))!));
    if (cells.every(cell => !cell.text.trim())) continue;
    if (rows.length >= MAX_IMPORT_ROWS) throw new Error("Mỗi lượt nhập tối đa 500 dòng dữ liệu.");
    const errors: string[] = [], warnings: string[] = [];
    const text = (index: number) => cells[index].text.normalize("NFC").trim();
    if (cells.some(cell => cell.type === ExcelJS.ValueType.Formula || cell.type === ExcelJS.ValueType.Error))
      errors.push("Không nhận công thức hoặc ô lỗi; hãy dán giá trị trước khi nhập.");
    if (cells.some(cell => cell.text.length > 4000 || cell.text.includes("\uFFFD"))) errors.push("Nội dung quá dài hoặc có ký tự lỗi.");
    let phone = normalizeImportPhone(text(1));
    if (!phone && /^[35789]\d{8}$/.test(text(1))) {
      phone = "0" + text(1); warnings.push("SĐT thiếu số 0 đầu: đã đề xuất bổ sung, cần xác nhận.");
    }
    if (!phone) errors.push("Số điện thoại không hợp lệ.");
    if (!text(0)) errors.push("Thiếu tên khách hàng.");
    if (!text(4)) errors.push("Thiếu nhân viên chăm sóc.");
    const date = parseImportDate(cells[3].value, !!book.properties.date1904);
    if (!date || Date.parse(date.iso) > Date.now()) errors.push("Ngày chăm sóc không hợp lệ hoặc ở tương lai.");
    const end = text(11) ? parseImportDate(cells[11].value, !!book.properties.date1904) : null;
    if (text(11) && !end) errors.push("Ngày hết liệu trình không hợp lệ.");
    const channel = canonicalImportChannel(text(5));
    if (!channel) errors.push("Kênh chăm sóc không được hỗ trợ.");
    if (!text(7) || !text(8) || !text(9)) errors.push("Thiếu mục đích, liên lạc hoặc kết quả.");
    const data: ImportActivity = {
      occurredAt: date?.iso || "", dateOnly: date?.dateOnly ?? true,
      employee: text(4), channel, purchaseChannel: text(6), purpose: text(7),
      contactStatus: text(8), result: text(9), noPurchaseReason: text(10),
      productEndDate: end ? importLocalDay(end.iso) : "", note: text(16),
    };
    for (const [index, field, min, max] of [[2, "careAttempt", 1, 10000], [14, "satisfaction", 1, 5]] as const) {
      if (!text(index)) continue;
      const number = Number(text(index));
      if (!Number.isInteger(number) || number < min || number > max) errors.push(`${CARE_IMPORT_HEADERS[index]} không hợp lệ.`);
      else data[field] = number;
    }
    const boolValue = (index: number): boolean | undefined => {
      const key = keyOf(text(index)); if (!key) return undefined;
      if (["co", "dung", "true", "1"].includes(key)) return true;
      if (["khong", "sai", "false", "0"].includes(key)) return false;
      errors.push(`${CARE_IMPORT_HEADERS[index]} chỉ nhận Có/Không hoặc Đúng/Sai.`); return undefined;
    };
    data.adverseReaction = boolValue(15);
    const timely = boolValue(13);
    if (date && end) {
      data.dueOffsetDays = Math.round((Date.parse(importLocalDay(date.iso)) - Date.parse(importLocalDay(end.iso))) / 86400_000);
      if (keyOf(data.purpose).includes("nhactaimua")) data.repurchaseTimely = data.dueOffsetDays >= -7 && data.dueOffsetDays <= 3;
      if (timely !== undefined && timely !== data.repurchaseTimely)
        warnings.push(`Nhắc đúng lúc trong file cần kiểm tra (hai ngày lệch ${data.dueOffsetDays} ngày; chỉ tính chỉ số cho Nhắc tái mua).`);
      if (text(12) && Number(text(12)) !== data.dueOffsetDays) warnings.push("Lệch ngày trong file khác kết quả tính từ ngày chăm và ngày hết liệu trình.");
    } else if (text(12) || text(13)) warnings.push("Không đủ ngày để kiểm chứng Lệch ngày/Nhắc đúng lúc.");
    rows.push({ row: n, name: text(0), phone, data, errors, warnings,
      original: { channel: text(5), careAttempt: text(2), dueOffsetDays: text(12), repurchaseTimely: text(13) } });
  }
  if (!rows.length) throw new Error("File chưa có dòng dữ liệu chăm sóc.");
  return rows;
}
