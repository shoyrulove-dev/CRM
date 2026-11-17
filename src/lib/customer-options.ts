export const customerSegments = ["Chưa xác định", "Trung thành", "Vãng lai"];
export const healthGoals = ["Chưa xác định", "Xương khớp", "Tim mạch - tuần hoàn", "Tiêu hóa", "Da - làm đẹp", "Miễn dịch", "Giấc ngủ - thần kinh", "Sinh lý", "Tăng chiều cao cho bé", "Tổng quát", "Khác"];

// Only equivalent labels are normalized; other historical values remain visible.
export function normalizeClassification(value: string) {
  return ({ "Khách trung thành": "Trung thành", "Tim mạch": "Tim mạch - tuần hoàn" } as Record<string, string>)[value] || value;
}
