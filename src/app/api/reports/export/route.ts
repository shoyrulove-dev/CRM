import { NextRequest } from "next/server";
import { getReportData } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";
import { createExcelFile, excelResponse } from "@/lib/excel";
import { hasPermission } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasPermission(user, "reports"))
    return new Response("Không có quyền xuất báo cáo.", { status: 403 });
  const data = await getReportData(user),
    from = request.nextUrl.searchParams.get("from"),
    to = request.nextUrl.searchParams.get("to");
  const activities = data.activities.filter(
    (item) =>
      (!from || item.occurredAt.slice(0, 10) >= from) &&
      (!to || item.occurredAt.slice(0, 10) <= to),
  );
  const headers = [
    "Mã KH",
    "Mã đơn",
    "Lần chăm",
    "Thời gian",
    "Nhân viên",
    "Kênh chăm sóc",
    "Kênh mua",
    "Mục đích",
    "Liên lạc",
    "Kết quả",
    "Lý do chưa mua",
    "Ngày hết liệu trình",
    "Lệch ngày",
    "Nhắc đúng lúc",
    "Hài lòng",
    "Phản ứng bất thường",
    "Ghi chú",
  ];
  const rows = activities.map((item) => [
    item.customerId,
    item.orderId || "",
    item.careAttempt || "",
    item.occurredAt,
    item.employee,
    item.channel,
    item.purchaseChannel || "",
    item.purpose,
    item.contactStatus,
    item.result,
    item.noPurchaseReason || "",
    item.productEndDate || "",
    item.dueOffsetDays ?? "",
    item.repurchaseTimely === undefined
      ? ""
      : item.repurchaseTimely
        ? "Đúng"
        : "Sai",
    item.satisfaction || "",
    item.adverseReaction ? "Có" : "Không",
    item.note || "",
  ]);
  const file = await createExcelFile("Báo cáo CSKH", headers, rows);
  return excelResponse(
    file,
    `bao-cao-cskh-${from || "all"}-${to || "all"}.xlsx`,
  );
}
