import ExcelJS from "exceljs";

export type ExcelCell = string | number | boolean | Date | null | undefined;

export function vietnamDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function createExcelFile(
  sheetName: string,
  headers: string[],
  rows: ExcelCell[][],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Nichiei CRM";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF174A73" },
  };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 24;
  sheet.autoFilter = {
    from: "A1",
    to: `${sheet.getColumn(headers.length).letter}1`,
  };
  sheet.columns.forEach((column) => {
    let width = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      width = Math.max(
        width,
        Math.min(42, String(cell.value ?? "").length + 2),
      );
    });
    column.width = width;
    column.alignment = { vertical: "top", wrapText: true };
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function excelResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
