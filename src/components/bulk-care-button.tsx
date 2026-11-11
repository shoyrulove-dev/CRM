"use client";
import { CalendarRange } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";

export function BulkCareButton({
  products,
  employees,
}: {
  products: string[];
  employees: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      purpose: form.get("purpose"),
      dueAt: form.get("dueAt"),
      channel: form.get("channel"),
      product: form.get("product"),
      owner: form.get("owner"),
      assignToCustomerOwner: form.get("assignMode") === "customer",
    };
    const preview = await fetch("/api/care/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, preview: true }),
    });
    const previewJson = await preview.json();
    if (!preview.ok) {
      setError(previewJson.error);
      setLoading(false);
      return;
    }
    if (
      !previewJson.count ||
      !confirm(`Tạo lịch cho ${previewJson.count} khách hàng phù hợp?`)
    ) {
      setLoading(false);
      return;
    }
    const response = await fetch("/api/care/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Không thể tạo lịch hàng loạt.");
      setLoading(false);
      return;
    }
    alert(`Đã tạo ${json.created} lịch, bỏ qua ${json.skipped} lịch trùng.`);
    setOpen(false);
    setLoading(false);
    router.refresh();
  }
  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <CalendarRange size={18} />
        Tạo hàng loạt
      </button>
      {open && (
        <Modal
          title="Tạo lịch chăm sóc hàng loạt"
          description="Lọc theo sản phẩm đã mua hoặc áp dụng cho toàn bộ khách hàng."
          onClose={() => setOpen(false)}
        >
          <form className="entity-form" onSubmit={submit}>
            <div className="form-grid">
              <label className="full">
                Sản phẩm đã mua
                <select name="product">
                  <option value="">Tất cả khách hàng</option>
                  {products.map((product) => (
                    <option key={product}>{product}</option>
                  ))}
                </select>
              </label>
              <label className="full">
                Mục đích
                <input
                  name="purpose"
                  required
                  defaultValue="Chăm sóc định kỳ"
                />
              </label>
              <label>
                Ngày giờ
                <input name="dueAt" type="datetime-local" required />
              </label>
              <label>
                Kênh
                <select name="channel">
                  <option>Gọi điện</option>
                  <option>Zalo</option>
                  <option>Facebook</option>
                  <option>SMS</option>
                </select>
              </label>
              <label>
                Giao việc
                <select name="assignMode">
                  <option value="customer">
                    Theo nhân viên đang phụ trách khách
                  </option>
                  <option value="one">Giao cho một nhân viên</option>
                </select>
              </label>
              <label>
                Nhân viên
                <select name="owner">
                  {employees.map((employee) => (
                    <option key={employee.id}>{employee.name}</option>
                  ))}
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
                {loading ? "Đang xử lý..." : "Kiểm tra và tạo lịch"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
