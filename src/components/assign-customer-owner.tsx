"use client";

import { FormEvent, useState } from "react";
import { UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";

export function AssignCustomerOwner({
  customerId,
  owner,
  employees,
}: {
  customerId: string;
  owner: string;
  employees: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    const selected = String(new FormData(event.currentTarget).get("owner") || "");
    try {
    const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner: selected }),
      signal: AbortSignal.timeout(30000),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Không thể phân công.");
    setOpen(false);
    router.refresh();
    } catch { setMessage("Chưa nhận được xác nhận lưu. Vui lòng kiểm tra kết nối và thử lại."); }
    finally { setBusy(false); }
  }
  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <UserRoundCog size={17} /> Phân công
      </button>
      {open && (
        <Modal title="Phân công khách hàng" description="Chuyển hồ sơ và công việc đang mở. Giữ nguyên nhân viên bán hàng trong đơn cũ." onClose={() => { if (!busy) setOpen(false); }}>
          <form className="entity-form" onSubmit={submit}>
            <label>
              Nhân viên phụ trách
              <select name="owner" defaultValue={owner} required>
                <option>Chưa phân công</option>
                {employees.map((employee) => (
                  <option key={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>
            {message && <p>{message}</p>}
            <footer>
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button>
              <button className="primary-button" disabled={busy}>{busy ? "Đang lưu..." : "Lưu phân công"}</button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
