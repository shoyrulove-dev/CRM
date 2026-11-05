import type { CareTask, Customer } from "./types";

export const customers: Customer[] = [
  { id: "KH-1042", name: "Nguyễn Thị Yến Phương", phone: "0931 497 487", owner: "Vân Anh", segment: "Khách trung thành", orders: 8, revenue: 160700000, lastOrder: "02/11/2026", nextCare: "06/11/2026", status: "due", healthGoal: "Tiêu hóa" },
  { id: "KH-0981", name: "Phạm Thị Thanh Hương", phone: "0918 750 556", owner: "Trâm", segment: "Mua lại", orders: 5, revenue: 48250000, lastOrder: "28/10/2026", nextCare: "05/11/2026", status: "overdue", healthGoal: "Xương khớp" },
  { id: "KH-0764", name: "Bùi Thị Thu Trâm", phone: "0948 620 879", owner: "Linh", segment: "Đang theo liệu trình", orders: 3, revenue: 26700000, lastOrder: "24/10/2026", nextCare: "07/11/2026", status: "due", healthGoal: "Da - làm đẹp" },
  { id: "KH-0517", name: "Nguyễn Oanh", phone: "0905 355 357", owner: "Ly", segment: "Khách mới", orders: 1, revenue: 6450000, lastOrder: "03/11/2026", nextCare: "10/11/2026", status: "due", healthGoal: "Miễn dịch" },
  { id: "KH-0449", name: "Hà Thu Hảo", phone: "0974 345 425", owner: "Phước An", segment: "Cần kéo lại", orders: 2, revenue: 12900000, lastOrder: "08/09/2026", nextCare: "04/11/2026", status: "overdue", healthGoal: "Tim mạch" },
];

export const tasks: CareTask[] = [
  { id: "CS-381", customer: "Phạm Thị Thanh Hương", phone: "0918 750 556", purpose: "Khảo sát sau mua 7 ngày", owner: "Trâm", dueAt: "Hôm qua, 09:00", channel: "Gọi điện", status: "overdue" },
  { id: "CS-382", customer: "Nguyễn Thị Yến Phương", phone: "0931 497 487", purpose: "Hỏi thăm cảm nhận", owner: "Vân Anh", dueAt: "Hôm nay, 10:30", channel: "Zalo", status: "due" },
  { id: "CS-383", customer: "Bùi Thị Thu Trâm", phone: "0948 620 879", purpose: "Nhắc tái mua", owner: "Linh", dueAt: "Hôm nay, 14:00", channel: "Gọi điện", status: "due" },
  { id: "CS-379", customer: "Nguyễn Oanh", phone: "0905 355 357", purpose: "Hướng dẫn sử dụng", owner: "Ly", dueAt: "04/11, 16:00", channel: "Zalo", status: "done" },
];

export const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
