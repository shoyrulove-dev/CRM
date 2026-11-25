const ExcelJS = require("exceljs");

function normalizePhone(value) {
  const raw = String(value ?? "").trim().replace(/\.0$/, "");
  if (!/^[\d+ .()-]+$/.test(raw)) return "";
  let phone = raw.replace(/\D/g, "");
  if (phone.length === 11 && phone.startsWith("84")) phone = "0" + phone.slice(2);
  if (phone.length === 9) phone = "0" + phone;
  return /^0[35789]\d{8}$/.test(phone) ? phone : "";
}

function cellText(cell) {
  const value = cell.value;
  if (value && typeof value === "object" && "result" in value) return String(value.result ?? "");
  return cell.text;
}

function headerKey(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, "");
}

function purchaseDay(cell) {
  const value = cell.value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  const text = cellText(cell).trim();
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  const date = local ? `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}` : text;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(date);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : "";
}

async function preview(file, sheetName, cutoff, onPurchase, maxRows = Infinity) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(file, { sharedStrings: "cache", styles: "cache" });
  const phones = new Set();
  const samples = [];
  const totals = { rows: 0, eligible: 0, invalidPhone: 0, invalidDate: 0, afterCutoff: 0, missingOrder: 0, missingSku: 0 };
  let columns, minDay, maxDay, selected;
  for await (const sheet of workbook) {
    if (sheetName && sheet.name !== sheetName) continue;
    selected = sheet.name;
    for await (const row of sheet) {
      if (!row.hasValues) continue;
      if (!columns) {
        const headers = new Map();
        row.eachCell((cell, number) => headers.set(headerKey(cellText(cell)), number));
        const find = (...keys) => keys.map(key => headers.get(key)).find(Boolean);
        columns = {
          date: find("ngayhachtoan", "ngaymua", "ngayban", "ngaydon"),
          phone: find("sdt", "sodienthoai", "dienthoai"),
          order: find("madon", "madonhang", "sochungtu"),
          sku: find("sku", "mahang", "masanpham"),
        };
        if (!columns.date || !columns.phone) throw new Error("Missing purchase date or phone column.");
        continue;
      }
      totals.rows++;
      if (totals.rows > maxRows) throw new Error("ROW_LIMIT");
      const day = purchaseDay(row.getCell(columns.date));
      const phone = normalizePhone(cellText(row.getCell(columns.phone)));
      if (day) {
        if (!minDay || day < minDay) minDay = day;
        if (!maxDay || day > maxDay) maxDay = day;
      }
      if (!day) totals.invalidDate++;
      if (!phone) totals.invalidPhone++;
      if (day && day > cutoff) totals.afterCutoff++;
      if (!columns.order || !cellText(row.getCell(columns.order)).trim()) totals.missingOrder++;
      if (!columns.sku || !cellText(row.getCell(columns.sku)).trim()) totals.missingSku++;
      if (day && day <= cutoff && phone) {
        totals.eligible++;
        phones.add(phone);
        if (onPurchase) await onPurchase({
          row: row.number,
          day,
          phone,
          order: columns.order ? cellText(row.getCell(columns.order)).trim() : "",
          sku: columns.sku ? cellText(row.getCell(columns.sku)).trim().toUpperCase() : "",
        });
      } else if (samples.length < 20) {
        samples.push({ row: row.number, issues: [!phone && "invalid_phone", !day && "invalid_date", day > cutoff && "after_cutoff"].filter(Boolean) });
      }
    }
    break;
  }
  if (!columns) throw new Error("Selected worksheet has no header.");
  return { sheet: selected, cutoff, minDay, maxDay, ...totals, uniqueEligiblePhones: phones.size, hasOrderColumn: Boolean(columns.order), hasSkuColumn: Boolean(columns.sku), sampleIssues: samples };
}

module.exports = { preview, normalizePhone };

if (require.main === module) {
  const [, , file, cutoff, sheet] = process.argv;
  if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff ?? "")) {
    console.error("Usage: node scripts/preview-purchase-history.cjs <xlsx> <YYYY-MM-DD cutoff> [sheet]");
    process.exitCode = 1;
  } else {
    preview(file, sheet, cutoff).then(result => console.log(JSON.stringify(result, null, 2)))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
