import { Search } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/status-pill";
import { formatDate } from "@/lib/format-date";
import { money } from "@/lib/demo-data";
import { getCustomersPage } from "@/lib/data-store";
import { CreateCustomerButton } from "@/components/create-customer-button";
import { getCurrentUser } from "@/lib/current-user";
import { hasPermission } from "@/lib/session";
import { redirect } from "next/navigation";
import { listUsers } from "@/lib/users";
import { ExportCustomersButton } from "@/components/export-customers-button";

export const dynamic = "force-dynamic";
export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    owner?: string;
    status?: string;
    page?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!hasPermission(user, "customers")) redirect("/");
  const employees =
    user && ["admin", "super_admin"].includes(user.role)
      ? (await listUsers()).filter((item) => item.active)
      : [];
  const fromDate = params.from ? `${params.from}-01` : undefined;
  const toDate = params.to ? `${params.to}-31` : undefined;
  const size = 20,
    requestedPage = Math.max(1, Number(params.page) || 1),
    result = await getCustomersPage(
      {
        search: params.q,
        owner: params.owner,
        status: params.status,
        from: fromDate,
        to: toDate,
        page: requestedPage,
        size,
      },
      user,
    ),
    totalPages = Math.max(1, Math.ceil(result.total / size)),
    page = Math.min(totalPages, requestedPage),
    customers = result.items,
    filteredRevenue = result.totalRevenue,
    filteredOrders = result.totalOrders;
  const query = (next: Record<string, string | number | undefined>) => {
    const result = new URLSearchParams();
    Object.entries({ ...params, ...next }).forEach(([key, value]) => {
      if (value) result.set(key, String(value));
    });
    return `?${result}`;
  };
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">QUẢN LÝ KHÁCH HÀNG</p>
          <h1>Khách hàng</h1>
          <p>Theo dõi hồ sơ, lịch sử mua hàng và hành trình chăm sóc.</p>
        </div>
        <CreateCustomerButton />
      </div>
      <section className="customer-summary-strip">
        <div>
          <span>Khách hàng</span>
          <b>{result.total}</b>
        </div>
        <div>
          <span>Tổng đơn hàng</span>
          <b>{filteredOrders}</b>
        </div>
        <div>
          <span>Tổng doanh thu</span>
          <b>{money.format(filteredRevenue)}</b>
        </div>
      </section>
      <section className="panel list-panel">
        <form className="list-toolbar" method="get">
          <div className="search-box">
            <Search size={18} />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Tìm tên, số điện thoại, mã khách hàng..."
            />
          </div>
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
          <input
            className="ghost-select"
            type="month"
            name="from"
            defaultValue={params.from}
            aria-label="Từ tháng mua"
          />
          <input
            className="ghost-select"
            type="month"
            name="to"
            defaultValue={params.to}
            aria-label="Đến tháng mua"
          />
          <select
            className="ghost-select"
            name="status"
            defaultValue={params.status || ""}
          >
            <option value="">Mọi trạng thái</option>
            <option value="due">Cần chăm sóc</option>
            <option value="overdue">Quá hạn</option>
            <option value="done">Đã hoàn thành</option>
          </select>
          <button className="secondary-button">Lọc</button>
          {user && ["admin", "super_admin"].includes(user.role) && (
            <ExportCustomersButton
              query={{
                q: params.q,
                owner: params.owner,
                status: params.status,
                from: params.from,
                to: params.to,
              }}
            />
          )}
        </form>
        <div className="filter-chips">
          <Link
            className={`chip ${!params.status ? "active" : ""}`}
            href={query({ status: undefined, page: 1 })}
          >
            Tất cả <b>{result.total}</b>
          </Link>
          <Link
            className={`chip ${params.status === "due" ? "active" : ""}`}
            href={query({ status: "due", page: 1 })}
          >
            Cần chăm sóc{" "}
            <b>{customers.filter((item) => item.status === "due").length}</b>
          </Link>
          <Link
            className={`chip ${params.status === "overdue" ? "active" : ""}`}
            href={query({ status: "overdue", page: 1 })}
          >
            Quá hạn{" "}
            <b>
              {customers.filter((item) => item.status === "overdue").length}
            </b>
          </Link>
        </div>
        <div className="table-wrap customer-table">
          <table>
            <thead>
              <tr>
                <th>KHÁCH HÀNG</th>
                <th>PHÂN NHÓM</th>
                <th>NHÂN VIÊN</th>
                <th>ĐƠN HÀNG</th>
                <th>DOANH THU</th>
                <th>ĐƠN GẦN NHẤT</th>
                <th>LẦN CHĂM GẦN NHẤT</th>
                <th>LỊCH TIẾP THEO</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {customers.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link
                      href={`/customers/${item.id}`}
                      className="customer-cell customer-link"
                    >
                      <i>
                        {item.name
                          .split(" ")
                          .slice(-2)
                          .map((value) => value[0])
                          .join("")}
                      </i>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.id} · {item.phone}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    <span className="segment">{item.segment}</span>
                    <small>{item.healthGoal}</small>
                  </td>
                  <td>
                    <span className="person">
                      <i>{(item.haravanEmployee || item.owner).slice(-2).toUpperCase()}</i>
                      {item.haravanEmployee || item.owner}
                    </span>
                    {item.haravanEmployee && item.owner !== item.haravanEmployee && item.owner !== "Chưa phân công" && <small>CRM: {item.owner}</small>}
                  </td>
                  <td>
                    <strong>{item.orders}</strong>
                  </td>
                  <td>
                    <strong>{money.format(item.revenue)}</strong>
                  </td>
                  <td>
                    {item.lastOrder
                      ? new Date(
                          `${item.lastOrder}T00:00:00+07:00`,
                        ).toLocaleDateString("vi-VN")
                      : "—"}
                  </td>
                  <td>
                    {item.lastCare
                      ? new Date(item.lastCare).toLocaleString("vi-VN", {
                          timeZone: "Asia/Bangkok",
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td>
                    <strong>
                      {formatDate(item.nextCare)}
                    </strong>
                    <StatusPill status={item.status} />
                  </td>
                  <td>
                    <Link
                      className="row-action detail-link"
                      href={`/customers/${item.id}`}
                    >
                      Xem
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <span>
            Hiển thị {customers.length ? (page - 1) * size + 1 : 0}–
            {Math.min(page * size, result.total)} trên {result.total} khách hàng
          </span>
          <div>
            <Link
              className="secondary-button"
              href={query({ page: Math.max(1, page - 1) })}
            >
              ‹
            </Link>
            <span className="chip active">
              {page}/{totalPages}
            </span>
            <Link
              className="secondary-button"
              href={query({ page: Math.min(totalPages, page + 1) })}
            >
              ›
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
