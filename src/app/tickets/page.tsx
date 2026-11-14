import { Download, Search } from "lucide-react";
import { listCustomerContacts, getTicketsPage } from "@/lib/data-store";
import { Pagination } from "@/components/pagination";
import { LazyCreateButton } from "@/components/lazy-create-button";
import { TicketActions } from "@/components/ticket-actions";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/users";
import { TicketDetailButton } from "@/components/ticket-detail-button";

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
    resolution?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams,
    user = await getCurrentUser(),
    [result, allUsers] = await Promise.all([
      getTicketsPage(params, user),
      listUsers(),
    ]);
  if (!hasPermission(user, "tickets")) redirect("/");
  const customers = await listCustomerContacts(result.items.map((item) => item.customerId), user);
  const phoneByCustomer = new Map(
    customers.map((item) => [item.id, item.phone]),
  );
  const tickets = result.items;
  const employees = allUsers
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, name: item.name }));
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">HỖ TRỢ KHÁCH HÀNG</p>
          <h1>Phiếu yêu cầu</h1>
          <p>Theo dõi và xử lý yêu cầu của khách hàng. Phiếu đã đóng được giữ nguyên lịch sử.</p>
        </div>
        <div className="page-actions"><a className="secondary-button" href={`/api/tickets/export?${new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][]).toString()}`}><Download size={17} />Xuất Excel</a><LazyCreateButton kind="tickets" /></div>
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
          <select className="ghost-select" name="resolution" defaultValue={params.resolution || ""}>
            <option value="">Mọi hướng xử lý</option><option>Thu hàng - Hoàn tiền</option><option>Đổi hàng</option><option>Điều chỉnh cách dùng</option><option>Khác</option>
          </select>
          <input
            className="ghost-select"
            type="month"
            name="from"
            defaultValue={params.from}
            aria-label="Từ tháng"
          />
          <input
            className="ghost-select"
            type="month"
            name="to"
            defaultValue={params.to}
            aria-label="Đến tháng"
          />
          {user && ["admin", "super_admin"].includes(user.role) && (
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
                    <TicketDetailButton ticket={item} phone={phoneByCustomer.get(item.customerId) || ""} />
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
                    <TicketActions id={item.id} status={item.status} resolution={item.resolution} />
                  </td>
                  <td>{item.resolution || "Chưa chọn"}</td>
                  <td>{item.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={result.page} size={result.size} total={result.total} pathname="/tickets" params={params} />
      </section>
    </>
  );
}
