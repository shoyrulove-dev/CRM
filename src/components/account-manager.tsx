"use client";
import { FormEvent, useMemo, useState } from "react";
import { Archive, KeyRound, Lock, LockOpen, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import type { UserRole } from "@/lib/types";
type Row = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  groupId?: string;
  archivedAt?: string;
};
type Group = { id: string; name: string };
type Filter = "all" | UserRole | "archived";
const labels: Record<UserRole, string> = {
  admin: "Quản trị",
  sales: "Bán hàng",
  care: "Chăm sóc khách hàng",
};
export function AccountManager({
  users,
  groups = [],
}: {
  users: Row[];
  groups?: Group[];
}) {
  const [filter, setFilter] = useState<Filter>("all"),
    [mode, setMode] = useState<"create" | "edit" | null>(null),
    [selected, setSelected] = useState<Row | null>(null),
    [error, setError] = useState(""),
    router = useRouter(),
    rows = useMemo(
      () =>
        filter === "all"
          ? users.filter((x) => !x.archivedAt)
          : filter === "archived"
            ? users.filter((x) => x.archivedAt)
            : users.filter((x) => x.role === filter && !x.archivedAt),
      [filter, users],
    );
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.currentTarget).entries()),
        ),
      }),
      json = await res.json();
    if (!res.ok) return setError(json.error || "Không thể tạo tài khoản");
    close();
    router.refresh();
  }
  async function patch(id: string, body: object) {
    const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      json = await res.json();
    if (!res.ok) {
      setError(json.error || "Không thể cập nhật");
      return false;
    }
    router.refresh();
    return true;
  }
  function close() {
    setMode(null);
    setSelected(null);
    setError("");
  }
  async function edit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = Object.fromEntries(new FormData(e.currentTarget).entries());
    if (
      await patch(selected.id, {
        name: form.name,
        role: form.role,
        groupId: form.groupId,
      })
    )
      close();
  }
  async function reset(u: Row) {
    const password = prompt(
      `Nhập mật khẩu mới cho ${u.name} (ít nhất 8 ký tự)`,
    );
    if (password) await patch(u.id, { password });
  }
  async function archive(u: Row) {
    if (
      !confirm(
        `Lưu trữ tài khoản ${u.name}? Tài khoản sẽ không thể đăng nhập nhưng lịch sử vẫn được giữ lại.`,
      )
    )
      return;
    const response = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok)
      return setError(json.error || "Không thể lưu trữ tài khoản");
    router.refresh();
  }
  return (
    <>
      <div className="account-head">
        <div className="account-tabs">
          {(
            [
              ["all", "Tất cả"],
              ["admin", "Quản trị"],
              ["sales", "Bán hàng"],
              ["care", "Chăm sóc"],
              ["archived", "Đã lưu trữ"],
            ] as [Filter, string][]
          ).map(([key, text]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key)}
            >
              {text}
              <b>
                {key === "all"
                  ? users.filter((x) => !x.archivedAt).length
                  : key === "archived"
                    ? users.filter((x) => x.archivedAt).length
                    : users.filter((x) => x.role === key && !x.archivedAt)
                        .length}
              </b>
            </button>
          ))}
        </div>
        <button className="primary-button" onClick={() => setMode("create")}>
          <Plus size={17} />
          Thêm tài khoản
        </button>
      </div>
      <section className="panel account-table">
        <div className="account-row account-header">
          <span>NHÂN VIÊN</span>
          <span>EMAIL</span>
          <span>NHÓM QUYỀN</span>
          <span>TRẠNG THÁI</span>
          <span>THAO TÁC</span>
        </div>
        {rows.map((u) => (
          <div className="account-row" key={u.id}>
            <div className="account-person">
              <i>
                {u.name
                  .split(" ")
                  .slice(-2)
                  .map((x) => x[0])
                  .join("")}
              </i>
              <b>{u.name}</b>
            </div>
            <span>{u.email}</span>
            <span className="role-badge">{labels[u.role]}</span>
            <span className={`account-state ${u.active ? "on" : "off"}`}>
              {u.archivedAt
                ? "Đã lưu trữ"
                : u.active
                  ? "Đang hoạt động"
                  : "Đã khóa"}
            </span>
            <div className="row-buttons">
              <button
                className="icon-action"
                title="Sửa tài khoản"
                aria-label={`Sửa tài khoản ${u.name}`}
                onClick={() => {
                  setSelected(u);
                  setMode("edit");
                }}
              >
                <Pencil />
              </button>
              {!u.archivedAt && (
                <button
                  className="danger-action icon-action"
                  title="Lưu trữ tài khoản"
                  aria-label={`Lưu trữ tài khoản ${u.name}`}
                  onClick={() => archive(u)}
                >
                  <Archive />
                </button>
              )}
              <button
                className="icon-action"
                title="Đặt lại mật khẩu"
                aria-label={`Đặt lại mật khẩu ${u.name}`}
                onClick={() => reset(u)}
              >
                <KeyRound />
              </button>
              <button
                className={`${u.active ? "danger-action" : "success-action"} icon-action`}
                title={u.active ? "Khóa tài khoản" : "Mở tài khoản"}
                aria-label={`${u.active ? "Khóa" : "Mở"} tài khoản ${u.name}`}
                onClick={() => patch(u.id, { active: !u.active })}
              >
                {u.active ? <Lock /> : <LockOpen />}
              </button>
            </div>
          </div>
        ))}
        {!rows.length && (
          <div className="account-empty">Chưa có tài khoản trong nhóm này.</div>
        )}
      </section>
      {mode === "create" && (
        <Modal
          title="Thêm tài khoản"
          description="Tạo tài khoản riêng cho nhân viên."
          onClose={close}
        >
          <form className="entity-form" onSubmit={create}>
            <AccountFields />
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={close}
              >
                Hủy
              </button>
              <button className="primary-button">Tạo tài khoản</button>
            </footer>
          </form>
        </Modal>
      )}
      {mode === "edit" && selected && (
        <Modal
          title="Sửa tài khoản"
          description={`Cập nhật thông tin của ${selected.name}.`}
          onClose={close}
        >
          <form className="entity-form" onSubmit={edit}>
            <div className="form-grid">
              <label className="full">
                Họ và tên
                <input name="name" defaultValue={selected.name} required />
              </label>
              <label className="full">
                Email
                <input value={selected.email} disabled />
              </label>
              <label className="full">
                Nhóm quyền
                <select name="role" defaultValue={selected.role}>
                  <RoleOptions />
                </select>
              </label>
              <label className="full">
                Nhóm tùy chỉnh
                <select name="groupId" defaultValue={selected.groupId || ""}>
                  <option value="">Theo vai trò mặc định</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <footer>
              <button
                type="button"
                className="secondary-button"
                onClick={close}
              >
                Hủy
              </button>
              <button className="primary-button">Lưu thay đổi</button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}
function RoleOptions() {
  return (
    <>
      <option value="admin">Quản trị</option>
      <option value="sales">Bán hàng</option>
      <option value="care">Chăm sóc khách hàng</option>
    </>
  );
}
function AccountFields() {
  return (
    <div className="form-grid">
      <label className="full">
        Họ và tên
        <input name="name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Nhóm quyền
        <select name="role">
          <RoleOptions />
        </select>
      </label>
      <label className="full">
        Mật khẩu tạm thời
        <input name="password" type="password" minLength={8} required />
      </label>
    </div>
  );
}
