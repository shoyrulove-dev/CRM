"use client";
import { CalendarRange } from "lucide-react";
import { FormEvent, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { recurrenceOptions } from "@/lib/care-recurrence";

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
  const [assignMode, setAssignMode] = useState("customer"), [progress, setProgress] = useState("");
  const requestKey = useRef("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      purpose: form.get("purpose"),
      dueAt: String(form.get("dueAt") || "") ? new Date(String(form.get("dueAt"))).toISOString() : "",
      channel: form.get("channel"),
      product: form.get("product"),
      owner: form.get("owner"),
      assignToCustomerOwner: form.get("assignMode") === "customer",
      filterOwner: form.get("filterOwner"), recurrence: form.get("recurrence"), intervalDays: form.get("intervalDays"), endDate: form.get("endDate"),
      requestKey: requestKey.current || (requestKey.current = crypto.randomUUID()),
    };
    try {
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
      !confirm(`Tạo chương trình cho ${previewJson.count} khách hàng? ${previewJson.unassigned || 0} khách chưa phân công; nếu giao theo hồ sơ thì lịch của họ sẽ nằm ở Chưa phân công. Tệp khách được chốt tại thời điểm tạo.`)
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
    let result = json;
    setProgress(`Đã ghi nhận chương trình cho ${json.count} khách. Đang tạo từng lô...`);
    while (result.remaining > 0 && !result.busy) {
      setProgress(`Còn ${result.remaining} khách trong lượt này. Nếu đóng trang, hệ thống sẽ tiếp tục chạy nền.`);
      const next = await fetch("/api/care/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ programId: json.programId }) });
      result = await next.json();
      if (!next.ok) throw new Error(result.error || "Chưa tạo xong lô. Chương trình đã lưu và sẽ chạy tiếp nền.");
    }
    alert("Đã lưu chương trình. Xem tiến độ và điều chỉnh tại Chương trình chăm sóc; chương trình sẽ tiếp tục theo lịch nền.");
    requestKey.current = "";
    setOpen(false);
    setLoading(false);
    router.refresh();
    } catch {
      setError("Kết nối bị gián đoạn. Nội dung được giữ lại; vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <button className="secondary-button" onClick={() => { setError(""); setProgress(""); setOpen(true); }}>
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
              <label className="full">Lọc tệp khách theo người phụ trách<select name="filterOwner"><option value="">Tất cả nhân viên / tất cả khách</option>{employees.map(e => <option key={e.id}>{e.name}</option>)}</select></label>
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
                <select name="assignMode" value={assignMode} onChange={event => setAssignMode(event.target.value)}>
                  <option value="customer">
                    Theo nhân viên đang phụ trách khách
                  </option>
                  <option value="one">Giao cho một nhân viên</option>
                </select>
              </label>
              {assignMode === "one" && <label>
                Nhân viên nhận việc
                <select name="owner">
                  {employees.map((employee) => (
                    <option key={employee.id}>{employee.name}</option>
                  ))}
                </select>
              </label>}
              {assignMode === "customer" && <p className="full">Mỗi khách được giao cho đúng người đang phụ trách hồ sơ. Không cần chọn thêm nhân viên nhận việc.</p>}
              <label>Lặp lại<select name="recurrence">{Object.entries(recurrenceOptions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Số ngày nếu chọn Theo số ngày<input name="intervalDays" type="number" min="1" max="3650" defaultValue="7" /></label>
              <label>Ngày kết thúc (không bắt buộc)<input name="endDate" type="date" /></label>
            </div>
            {progress && <p role="status">{progress}</p>}
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
