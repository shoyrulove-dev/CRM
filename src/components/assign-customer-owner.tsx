"use client";

import { FormEvent, useState } from "react";
import { UserRoundCog, X } from "lucide-react";
import { useRouter } from "next/navigation";

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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Đang lưu...");
    const selected = String(new FormData(event.currentTarget).get("owner") || "");
    const response = await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owner: selected }),
    });
    const json = await response.json();
    if (!response.ok) return setMessage(json.error || "Không thể phân công.");
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <UserRoundCog size={17} /> Phân công
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal-card compact-modal" onSubmit={submit}>
            <header>
              <div>
                <h2>Phân công khách hàng</h2>
                <p>Đơn hàng và công việc đang mở cũng được chuyển cho người mới.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </header>
            <label>
              Nhân viên phụ trách
              <select name="owner" defaultValue={owner} required>
                {owner === "Chưa phân công" && <option>Chưa phân công</option>}
                {employees.map((employee) => (
                  <option key={employee.id}>{employee.name}</option>
                ))}
              </select>
            </label>
            {message && <p>{message}</p>}
            <footer>
              <button type="button" className="secondary-button" onClick={() => setOpen(false)}>Hủy</button>
              <button className="primary-button">Lưu phân công</button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
