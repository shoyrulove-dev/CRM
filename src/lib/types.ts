export type CareStatus = "due" | "overdue" | "done";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  owner: string;
  segment: string;
  orders: number;
  revenue: number;
  lastOrder: string;
  nextCare: string;
  status: CareStatus;
  healthGoal: string;
}

export interface CareTask {
  id: string;
  customerId?: string;
  customer: string;
  phone: string;
  purpose: string;
  owner: string;
  dueAt: string;
  channel: string;
  status: CareStatus;
  orderId?: string;
  recurrence?: "none" | "monthly" | "yearly";
  completedAt?: string;
}

export interface CareActivity {
  id: string;
  customerId: string;
  occurredAt: string;
  channel: "Gọi điện" | "Facebook" | "Zalo" | "SMS" | "Trực tiếp";
  purpose: string;
  contactStatus: string;
  result: string;
  noPurchaseReason?: string;
  healthGoal?: string;
  satisfaction?: number;
  adverseReaction: boolean;
  note?: string;
  employee: string;
  orderId?: string;
  careAttempt?: number;
  purchaseChannel?: string;
  productEndDate?: string;
  dueOffsetDays?: number;
  repurchaseTimely?: boolean;
}

export interface ServiceTicket {
  id: string;
  customerId: string;
  customer: string;
  title: string;
  description: string;
  priority: "Bình thường" | "Cao" | "Khẩn cấp";
  status: "Mới" | "Đang xử lý" | "Chờ khách" | "Đã đóng";
  owner: string;
  createdAt: string;
  updatedAt?: string;
  closedAt?: string;
}

export interface SalesOrder {
  id: string;
  code: string;
  customerId: string;
  orderDate: string;
  channel: string;
  location: string;
  customerSource: string;
  purchaseType: "Mua mới" | "Mua lại";
  status: "Mua hàng" | "Trả hàng" | "Hủy";
  products: Array<{ sku: string; name: string; quantity: number; unitPrice: number; discount: number }>;
  promotion?: string;
  gift?: string;
  total: number;
  paidByVisa?: number;
  owner: string;
  salesperson: string;
  returnQuantity?: number;
  returnRevenue?: number;
  returnReceivedAt?: string;
  loyaltyNote?: string;
}
