import { getReportData } from "@/lib/data-store";

function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export async function GET() {
  const data = await getReportData();
  const rows = [["Mã KH", "Thời gian", "Nhân viên", "Kênh", "Mục đích", "Liên lạc", "Kết quả", "Lý do chưa mua", "Hài lòng", "Phản ứng bất thường", "Ghi chú"]];
  for (const activity of data.activities) rows.push([
    activity.customerId, activity.occurredAt, activity.employee, activity.channel, activity.purpose,
    activity.contactStatus, activity.result, activity.noPurchaseReason || "", activity.satisfaction?.toString() || "",
    activity.adverseReaction ? "Có" : "Không", activity.note || "",
  ]);
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="bao-cao-cskh-${new Date().toISOString().slice(0,10)}.csv"` } });
}
