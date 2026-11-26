"use client";
import { Download } from "lucide-react";
import { useState } from "react";
export function ReportExportButton({ from, to, owner, channel }: { from: string; to: string; owner?: string; channel?: string }) {
  const [template, setTemplate] = useState("detail");
  const query = new URLSearchParams({ from, to, template }); if (owner) query.set("owner", owner);
  if (channel) query.set("channel", channel);
  return <div className="export-picker"><select className="ghost-select" aria-label="Mẫu báo cáo" value={template} onChange={(e) => setTemplate(e.target.value)}><option value="detail">Chi tiết chăm sóc</option><option value="orders">Đơn hàng Haravan</option><option value="employee">Hiệu quả nhân viên</option><option value="customers">Tổng hợp khách hàng</option><option value="tickets">Phiếu yêu cầu</option></select><a className="secondary-button" href={`/api/reports/export?${query}`}><Download size={17} />Xuất Excel</a></div>;
}
