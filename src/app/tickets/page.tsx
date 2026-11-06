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
  searchParams: Promise<{ q?: string; status?: string }>;
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
  const tickets = allTickets.filter(
    (item) =>
      (!needle ||
        `${item.id} ${item.customer} ${item.title}`
          .toLowerCase()
          .includes(needle)) &&
      (!params.status || item.status === params.status),
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
              placeholder="Tìm mã phiếu, khách hàng..."
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
          <button className="secondary-button">Tìm kiếm</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MÃ PHIẾU</th>
                <th>NỘI DUNG</th>
                <th>KHÁCH HÀNG</th>
                <th>ƯU TIÊN</th>
                <th>TRẠNG THÁI</th>
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
