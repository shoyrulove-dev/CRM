"use client";
import { CalendarPlus, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { Customer } from "@/lib/types";
type Employee = { id: string; name: string };
type OrderPreset = { id: string; code: string; orderDate: string };
export function CreateCareButton({
  customers,
  employees = [],
  customerId,
  order,
  compact = false,
}: {
  customers: Customer[];
  employees?: Employee[];
  customerId?: string;
  order?: OrderPreset;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget),
      selected = customers.find((item) => item.id === form.get("customerId"));
    const response = await fetch("/api/care", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: selected?.id,
        customer: selected?.name,
        phone: selected?.phone,
        orderId: order?.id || "",
        purpose: form.get("purpose"),
        owner: form.get("owner"),
        dueAt: form.get("dueAt"),
        baseDate: form.get("baseDate"),
        offsetDays: form.get("offsetDays"),
        channel: form.get("channel"),
        recurrence: form.get("recurrence"),
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Không thể tạo lịch");
      setLoading(false);
      return;
    }
    setOpen(false);
    setLoading(false);
    router.refresh();
  }
  return (
    <>
      <button
        className={compact ? "order-action" : "primary-button"}
        onClick={() => setOpen(true)}
      >
        {compact ? <CalendarPlus size={14} /> : <Plus size={18} />}Tạo lịch chăm
        sóc
      </button>
      {open && (
        <Modal
          title={order ? `Tạo lịch từ đơn ${order.code}` : "Tạo lịch chăm sóc"}
          description="Chọn ngày cụ thể hoặc số ngày tính từ ngày mua hàng."
          onClose={() => setOpen(false)}
        >
          <form className="entity-form" onSubmit={submit}>
            <div className="form-grid">
              <label className="full">
                Khách hàng
                <select
                  name="customerId"
                  required
                  defaultValue={customerId || customers[0]?.id}
                >
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {customer.phone}
                    </option>
                  ))}
                </select>
              </label>
              {order && (
                <p className="form-note full">
                  Đơn liên quan: <b>{order.code}</b> · Ngày mua{" "}
                  {order.orderDate}
                </p>
              )}
              <label className="full">
                Mục đích
                <select
                  name="purpose"
                  defaultValue="Khảo sát tình trạng sử dụng"
                >
                  <option>Hướng dẫn sử dụng</option>
                  <option>Khảo sát tình trạng sử dụng</option>
                  <option>Hỏi thăm cảm nhận</option>
                  <option>Nhắc tái mua</option>
                  <option>Chăm sóc khách trung thành</option>
                  <option>Xử lý phản ánh</option>
                  <option>Sinh nhật</option>
                  <option>Ngày lễ</option>
                  <option>Gửi chương trình khuyến mãi mới</option>
                </select>
              </label>
              <label>
                Kênh
                <select name="channel">
                  <option>Gọi điện</option>
                  <option>Zalo</option>
                  <option>Facebook</option>
                  <option>SMS</option>
                  <option>Trực tiếp</option>
                </select>
              </label>
              <label>
                Phụ trách
                <select name="owner" defaultValue={employees[0]?.name || ""}>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.name}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày giờ cụ thể
                <input name="dueAt" type="datetime-local" />
              </label>
              <label>
                Ngày làm mốc
                <input
                  name="baseDate"
                  type="date"
                  defaultValue={order?.orderDate || ""}
                />
              </label>
              <label>
                Số ngày sau mốc
                <select name="offsetDays" defaultValue={order ? "7" : "0"}>
                  <option value="0">Cùng ngày</option>
                  <option value="7">7 ngày</option>
                  <option value="25">25 ngày</option>
                  <option value="45">45 ngày</option>
                </select>
              </label>
              <label>
                Lặp lại
                <select name="recurrence">
                  <option value="none">Không lặp</option>
                  <option value="monthly">Hàng tháng</option>
                  <option value="yearly">Hàng năm</option>
                </select>
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                Hủy
              </button>
              <button className="primary-button" disabled={loading}>
                {loading ? "Đang lưu..." : "Tạo lịch"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
