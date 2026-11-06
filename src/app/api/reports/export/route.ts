import { NextRequest } from "next/server";
import { getReportData } from "@/lib/data-store";
import { getCurrentUser } from "@/lib/current-user";

const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(request: NextRequest) {
  const data = await getReportData(await getCurrentUser()), from=request.nextUrl.searchParams.get("from"),to=request.nextUrl.searchParams.get("to");
  const activities=data.activities.filter(item=>(!from||item.occurredAt.slice(0,10)>=from)&&(!to||item.occurredAt.slice(0,10)<=to));
  const rows = [["Mã KH", "Mã đơn", "Lần chăm", "Thời gian", "Nhân viên", "Kênh chăm sóc", "Kênh mua", "Mục đích", "Liên lạc", "Kết quả", "Lý do chưa mua", "Ngày hết liệu trình", "Lệch ngày", "Nhắc đúng lúc", "Hài lòng", "Phản ứng bất thường", "Ghi chú"]];
  activities.forEach(item=>rows.push([item.customerId,item.orderId||"",String(item.careAttempt||""),item.occurredAt,item.employee,item.channel,item.purchaseChannel||"",item.purpose,item.contactStatus,item.result,item.noPurchaseReason||"",item.productEndDate||"",String(item.dueOffsetDays??""),item.repurchaseTimely===undefined?"":item.repurchaseTimely?"Đúng":"Sai",String(item.satisfaction||""),item.adverseReaction?"Có":"Không",item.note||""]));
  const csv="\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n");
  return new Response(csv,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="bao-cao-cskh-${from||"all"}-${to||"all"}.csv"`}});
}
