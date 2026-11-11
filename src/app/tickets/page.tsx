import { Search } from "lucide-react";
import { listCustomers, listTickets } from "@/lib/data-store";
import { CreateTicketButton } from "@/components/create-ticket-button";
import { TicketActions } from "@/components/ticket-actions";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    owner?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams,
    user = await getCurrentUser(),
    [allTickets, customers, allUsers] = await Promise.all([
      listTickets(user),
      listCustomers(undefined, user),
      listUsers(),
    ]),
    needle = (params.q || "").toLowerCase();
  if (!hasPermission(user, "tickets")) redirect("/");
  const phoneByCustomer = new Map(
    customers.map((item) => [item.id, item.phone]),
  );
  const tickets = allTickets.filter(
    (item) =>
      (!needle ||
        `${item.id} ${item.customer} ${item.title} ${phoneByCustomer.get(item.customerId) || ""}`
          .toLowerCase()
          .includes(needle)) &&
      (!params.status || item.status === params.status) &&
      (!params.owner || item.owner === params.owner) &&
      (!params.from || item.createdAt.slice(0, 10) >= params.from) &&
      (!params.to || item.createdAt.slice(0, 10) <= params.to),
  );
  const employees = allUsers
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, name: item.name }));
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">HỖ TRỢ KHÁCH HÀNG</p>
          <h1>Phiếu yêu cầu</h1>
          <p>Tạo, phân loại và đóng/mở từng phiếu theo khách hàng.</p>
        </div>
        <CreateTicketButton customers={customers} employees={employees} />
      </div>
      <section className="panel list-panel">
        <form className="list-toolbar" method="get">
          <div className="search-box">
            <Search size={18} />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Tìm mã phiếu, khách hàng hoặc số điện thoại..."
            />
          </div>
          <select
            className="ghost-select"
            name="status"
            defaultValue={params.status || ""}
          >
            <option value="">Mọi trạng thái</option>
            <option>Mới</option>
            <option>Đang xử lý</option>
            <option>Chờ khách</option>
            <option>Đã đóng</option>
          </select>
          <input
            className="ghost-select"
            type="date"
            name="from"
            defaultValue={params.from}
            aria-label="Từ ngày"
          />
          <input
            className="ghost-select"
            type="date"
            name="to"
            defaultValue={params.to}
            aria-label="Đến ngày"
          />
          {user?.role === "admin" && (
            <select
              className="ghost-select"
              name="owner"
              defaultValue={params.owner || ""}
            >
              <option value="">Tất cả nhân viên</option>
              {employees.map((employee) => (
                <option key={employee.id}>{employee.name}</option>
              ))}
            </select>
          )}
          <button className="secondary-button">Tìm kiếm</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MÃ PHIẾU</th>
                <th>NỘI DUNG</th>
                <th>KHÁCH HÀNG</th>
                <th>SỐ ĐIỆN THOẠI</th>
                <th>ƯU TIÊN</th>
                <th>TRẠNG THÁI</th>
                <th>HƯỚNG XỬ LÝ</th>
                <th>PHỤ TRÁCH</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.id}</strong>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </td>
                  <td>{item.customer}</td>
                  <td>{phoneByCustomer.get(item.customerId) || "—"}</td>
                  <td>
                    <span
                      className={`priority ${item.priority === "Khẩn cấp" ? "urgent" : ""}`}
                    >
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <TicketActions id={item.id} status={item.status} />
                  </td>
                  <td>{item.resolution || "Chưa chọn"}</td>
                  <td>{item.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
