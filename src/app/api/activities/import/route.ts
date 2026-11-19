import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { hasDatabase } from "@/lib/mongodb";
import { commitCareImport, isCareImportAdmin, previewCareImport } from "@/lib/care-import";
import { CARE_IMPORT_HEADERS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS } from "@/lib/care-import-parser";
import { createExcelFile, excelResponse } from "@/lib/excel";

export const maxDuration = 120;
export const runtime = "nodejs";

export async function GET() {
  if (!isCareImportAdmin(await getCurrentUser())) return NextResponse.json({ error: "Chỉ admin được nhập Excel." }, { status: 403 });
  return excelResponse(await createExcelFile("Chi tiết chăm sóc", CARE_IMPORT_HEADERS, []), "mau-nhap-lich-su-cskh.xlsx");
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isCareImportAdmin(user)) return NextResponse.json({ error: "Chỉ admin được nhập Excel." }, { status: 403 });
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng." }, { status: 503 });
  if (Number(request.headers.get("content-length")) > MAX_IMPORT_BYTES + 128 * 1024)
    return NextResponse.json({ error: "File tối đa 2 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size > MAX_IMPORT_BYTES)
      return NextResponse.json({ error: "Chọn file .xlsx tối đa 2 MB." }, { status: 400 });
    return NextResponse.json({ data: await previewCareImport(Buffer.from(await file.arrayBuffer()), file.name, user) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể đọc file Excel." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isCareImportAdmin(user)) return NextResponse.json({ error: "Chỉ admin được nhập Excel." }, { status: 403 });
  if (!hasDatabase()) return NextResponse.json({ error: "Kho dữ liệu chưa sẵn sàng." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.batchId !== "string" || !Array.isArray(body.rows) || !body.rows.length ||
      body.rows.length > MAX_IMPORT_ROWS || !body.rows.every((row: unknown) => Number.isInteger(row) && Number(row) >= 2) ||
      typeof body.acknowledgeWarnings !== "boolean")
    return NextResponse.json({ error: "Yêu cầu xác nhận không hợp lệ." }, { status: 400 });
  try {
    return NextResponse.json({ data: await commitCareImport(body.batchId, body.rows, body.acknowledgeWarnings, user) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể nhập dữ liệu. Có thể thử lại an toàn, không tạo trùng." }, { status: 400 });
  }
}
