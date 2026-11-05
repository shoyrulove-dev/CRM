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
  customer: string;
  phone: string;
  purpose: string;
  owner: string;
  dueAt: string;
  channel: string;
  status: CareStatus;
}
