"use client";
import { Plus, TicketPlus } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { Customer } from "@/lib/types";
type Employee = { id: string; name: string };
export function CreateTicketButton({
  customers,
  employees = [],
  customerId,
  orderCode,
  compact = false,
}: {
  customers: Customer[];
  employees?: Employee[];
  customerId?: string;
  orderCode?: string;
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
    const response = await fetch("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId: selected?.id,
        customer: selected?.name,
        title: form.get("title"),
        description: form.get("description"),
        priority: form.get("priority"),
        owner: form.get("owner"),
        orderCode,
        resolution: form.get("resolution"),
      }),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Không thể tạo phiếu");
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
        {compact ? <TicketPlus size={14} /> : <Plus size={18} />}Tạo phiếu yêu
        cầu
      </button>
      {open && (
        <Modal
          title={
            orderCode ? `Tạo phiếu từ đơn ${orderCode}` : "Tạo phiếu yêu cầu"
          }
          description="Theo dõi phản ánh, đổi trả hoặc yêu cầu phối hợp."
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
              <label className="full">
                Nội dung
                <input
                  name="title"
                  required
                  defaultValue={
                    orderCode ? `Yêu cầu liên quan đơn ${orderCode}` : ""
                  }
                  placeholder="Tóm tắt yêu cầu"
                />
              </label>
              <label className="full">
                Mô tả
                <textarea name="description" rows={4} />
              </label>
              <label>
                Ưu tiên
                <select name="priority">
                  <option>Bình thường</option>
                  <option>Cao</option>
                  <option>Khẩn cấp</option>
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
              <label className="full">
                Hướng xử lý
                <select name="resolution" defaultValue="Điều chỉnh cách dùng">
                  <option>Thu hàng - Hoàn tiền</option>
                  <option>Đổi hàng</option>
                  <option>Điều chỉnh cách dùng</option>
                  <option>Khác</option>
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
                {loading ? "Đang lưu..." : "Tạo phiếu"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
