"use client";
import { CalendarPlus, Plus } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { Customer, SalesOrder } from "@/lib/types";
import { useCustomerOrders } from "./use-customer-orders";
import { recurrenceOptions } from "@/lib/care-recurrence";

type Employee = { id: string; name: string };
type OrderPreset = Pick<SalesOrder, "id" | "code" | "orderDate" | "customerId" | "products">;

export function CreateCareButton({ customers, employees = [], customerId, order, orders = [], compact = false, initialOpen = false, loadOrdersOnDemand = false, preset }: {
  customers: Pick<Customer, "id" | "name" | "phone" | "owner">[]; employees?: Employee[]; customerId?: string; order?: OrderPreset; orders?: SalesOrder[]; compact?: boolean; initialOpen?: boolean; loadOrdersOnDemand?: boolean;
  preset?: { orderId?: string; channel: string };
}) {
  const [open, setOpen] = useState(initialOpen), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || customers[0]?.id || "");
  const [selectedOrder, setSelectedOrder] = useState(order?.id || preset?.orderId || "");
  const router = useRouter();
  const orderData = useCustomerOrders(orders, selectedCustomer, "care", loadOrdersOnDemand && open);
  const availableOrders = useMemo(() => order ? [order] : orderData.orders.filter((item) => item.customerId === selectedCustomer), [order, orderData.orders, selectedCustomer]);
  const currentOrder = availableOrders.find((item) => item.id === selectedOrder);
  async function submit(event: FormEvent<HTMLFormElement>) {
    if (orderData.loading || orderData.error) { event.preventDefault(); return; }
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget), selected = customers.find((item) => item.id === selectedCustomer);
    const product = currentOrder?.products.find((item) => item.sku === form.get("productSku"));
    const localDueAt = String(form.get("dueAt") || "");
    try {
    const response = await fetch("/api/care", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      customerId: selected?.id, orderId: currentOrder?.id || "", orderCode: currentOrder?.code || "", productSku: product?.sku || "", productName: product?.name || "",
      purpose: form.get("purpose"), owner: form.get("owner"), dueAt: localDueAt ? new Date(localDueAt).toISOString() : "", baseDate: form.get("baseDate"), offsetDays: form.get("offsetDays"), channel: form.get("channel"), recurrence: form.get("recurrence"), intervalDays: form.get("intervalDays"),
    }) });
    const json = await response.json(); if (!response.ok) { setError(json.error || "Không thể tạo lịch"); setLoading(false); return; }
    setOpen(false); setLoading(false); router.refresh();
    } catch {
      setError("Kết nối bị gián đoạn. Vui lòng thử lưu lại."); setLoading(false);
    }
  }
  return <>
    <button type="button" className={preset ? "secondary-button" : compact ? "order-action" : "primary-button"} onClick={() => setOpen(true)}>{compact || preset ? <CalendarPlus size={14} /> : <Plus size={18} />}{preset ? "Thêm lịch tiếp theo" : "Tạo lịch chăm sóc"}</button>
    {open && <Modal title={order ? `Tạo lịch từ đơn ${order.code}` : "Tạo lịch chăm sóc"} description="Chọn đơn và sản phẩm liên quan để nhân viên có đủ thông tin khi chăm sóc." onClose={() => setOpen(false)}>
      <form className="entity-form" onSubmit={submit}><div className="form-grid">
        <label className="full">Khách hàng<select name="customerId" required value={selectedCustomer} onChange={(e) => { setSelectedCustomer(e.target.value); setSelectedOrder(""); }} disabled={Boolean(customerId)}>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></label>
        <label>Đơn hàng<select value={selectedOrder} onChange={(e) => setSelectedOrder(e.target.value)} disabled={Boolean(order) || orderData.loading}><option value="">{orderData.loading ? "Đang tải đơn của khách..." : "Không gắn đơn hàng"}</option>{availableOrders.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.orderDate}</option>)}</select></label>
        <label>Sản phẩm<select name="productSku" disabled={!currentOrder}><option value="">Không chọn sản phẩm</option>{currentOrder?.products.map((item, index) => <option key={`${item.sku}-${index}`} value={item.sku}>{item.name}{item.sku ? ` · ${item.sku}` : ""}</option>)}</select></label>
        <label className="full">Mục đích<input name="purpose" list="care-purpose-options" required maxLength={200} defaultValue="Khảo sát tình trạng sử dụng" /><datalist id="care-purpose-options">{["Hướng dẫn sử dụng", "Khảo sát tình trạng sử dụng", "Hỏi thăm cảm nhận", "Nhắc tái mua", "Chăm sóc khách trung thành", "Xử lý phản ánh", "Sinh nhật", "Ngày lễ", "Gửi chương trình khuyến mãi mới"].map(value => <option key={value}>{value}</option>)}</datalist></label>
        <label>Kênh<select name="channel" defaultValue={preset?.channel}><option>Gọi điện</option><option>Zalo</option><option>Facebook</option><option>SMS</option><option>Trực tiếp</option></select></label>
        <label>Phụ trách<select key={selectedCustomer} name="owner" defaultValue={customers.find((item) => item.id === selectedCustomer)?.owner || employees[0]?.name || ""}>{employees.map((employee) => <option key={employee.id} value={employee.name}>{employee.name}</option>)}</select></label>
        <label>Ngày giờ cụ thể<input name="dueAt" type="datetime-local" step="300" /></label><label>Ngày làm mốc<input name="baseDate" type="date" defaultValue={order?.orderDate || ""} /></label>
        <label>Số ngày sau mốc<select name="offsetDays" defaultValue={order ? "7" : "0"}><option value="0">Cùng ngày</option><option value="7">7 ngày</option><option value="25">25 ngày</option><option value="45">45 ngày</option></select></label>
        <label>Lặp lại<select name="recurrence">{Object.entries(recurrenceOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Số ngày (nếu chọn Theo số ngày)<input name="intervalDays" type="number" min="1" max="3650" defaultValue="7" /></label>
      </div>{orderData.error && <p className="form-error">{orderData.error} <button type="button" className="secondary-button" onClick={orderData.retry}>Tải lại đơn</button></p>}{error && <p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button><button className="primary-button" disabled={loading || orderData.loading || !!orderData.error}>{loading ? "Đang lưu..." : "Tạo lịch"}</button></footer></form>
    </Modal>}
  </>;
}
