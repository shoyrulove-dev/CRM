import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  CircleDollarSign,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { getCustomerProfile } from "@/lib/data-store";
import { money } from "@/lib/demo-data";
import { CreateActivityButton } from "@/components/create-activity-button";
import { CreateTicketButton } from "@/components/create-ticket-button";
import { CreateCareButton } from "@/components/create-care-button";
import { CareTaskActions } from "@/components/care-task-actions";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/users";
import { AssignCustomerOwner } from "@/components/assign-customer-owner";

export const dynamic = "force-dynamic";
type Tab = "orders" | "reminders" | "care" | "tickets";
export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params,
    query = await searchParams,
    user = await getCurrentUser();
  const [{ customer, activities, orders, tickets, tasks }, allUsers] =
    await Promise.all([getCustomerProfile(id, user), listUsers()]);
  if (!customer) notFound();
  const employees = allUsers
    .filter((item) => item.active)
    .map((item) => ({ id: item.id, name: item.name }));
  const selected: Tab = (
    ["orders", "reminders", "care", "tickets"].includes(query.tab || "")
      ? query.tab
      : "orders"
  ) as Tab;
  const tabs: Array<[Tab, string, number]> = [
    ["orders", "Lịch sử bán hàng", orders.length],
    ["reminders", "Lịch nhắc chăm sóc", tasks.length],
    ["care", "Lịch sử chăm sóc", activities.length],
    ["tickets", "Phiếu yêu cầu", tickets.length],
  ];
  return (
    <>
      <div className="profile-back">
        <Link href="/customers">
          <ArrowLeft size={16} />
          Quay lại danh sách khách hàng
        </Link>
      </div>
      <div className="profile-heading">
        <div className="profile-identity">
          <span>
            {customer.name
              .split(" ")
              .slice(-2)
              .map((x) => x[0])
              .join("")}
          </span>
          <div>
            <div className="profile-title">
              <h1>{customer.name}</h1>
              <i>{customer.segment}</i>
            </div>
            <p>
              {customer.id} · <Phone size={13} />
              {customer.phone} · Phụ trách: <strong>{customer.owner}</strong>
            </p>
          </div>
        </div>
        <div className="profile-actions">
          {user?.role === "admin" && (
            <AssignCustomerOwner
              customerId={customer.id}
              owner={customer.owner}
              employees={employees}
            />
          )}
          <CreateTicketButton
            customers={[customer]}
            employees={employees}
            customerId={customer.id}
          />
          <CreateActivityButton customerId={customer.id} orders={orders} />
        </div>
      </div>
      <section className="profile-stats">
        <article>
          <ShoppingBag />
          <div>
            <span>Đơn hàng</span>
            <strong>{customer.orders}</strong>
          </div>
        </article>
        <article>
          <CircleDollarSign />
          <div>
            <span>Doanh thu tích lũy</span>
            <strong>{money.format(customer.revenue)}</strong>
          </div>
        </article>
        <article>
          <Package />
          <div>
            <span>Đơn gần nhất</span>
            <strong>{customer.lastOrder}</strong>
          </div>
        </article>
        <article>
          <CalendarPlus />
          <div>
            <span>Chăm sóc tiếp theo</span>
            <strong>{customer.nextCare}</strong>
          </div>
        </article>
      </section>
      <nav className="customer-tabs" aria-label="Hồ sơ khách hàng">
        {tabs.map(([key, label, count]) => (
          <Link
            key={key}
            href={`/customers/${id}?tab=${key}`}
            className={selected === key ? "active" : ""}
          >
            {label}
            <b>{count}</b>
          </Link>
        ))}
      </nav>
      <div className="profile-tab-layout">
        <main>
          {selected === "orders" && (
            <section className="panel profile-panel">
              <div className="panel-head">
                <div>
                  <h2>Lịch sử bán hàng</h2>
                  <p>
                    Chọn một đơn để tạo lịch hoặc phiếu yêu cầu với thông tin
                    điền sẵn.
                  </p>
                </div>
              </div>
              <div className="order-list">
                {orders.map((order) => (
                  <article key={order.id}>
                    <div className="order-head">
                      <div>
                        <strong>{order.code}</strong>
                        <span>
                          {order.orderDate} · {order.channel} · {order.location}
                        </span>
                      </div>
                      <div>
                        <span className="segment">{order.purchaseType}</span>
                        <strong>{money.format(order.total)}</strong>
                      </div>
                    </div>
                    <div className="order-products">
                      {order.products.map((product) => (
                        <div key={`${order.id}-${product.sku}`}>
                          <span>
                            <b>{product.name}</b>
                            <small>Mã sản phẩm: {product.sku}</small>
                          </span>
                          <span>
                            {product.quantity} ×{" "}
                            {money.format(product.unitPrice)}
                          </span>
                        </div>
                      ))}
                    </div>
                    {order.promotion && (
                      <p>
                        <b>Khuyến mãi:</b> {order.promotion}
                        {order.gift && ` · Quà tặng: ${order.gift}`}
                      </p>
                    )}
                    <footer className="order-quick-actions">
                      <CreateCareButton
                        customers={[customer]}
                        employees={employees}
                        customerId={customer.id}
                        order={{
                          id: order.id,
                          code: order.code,
                          orderDate: order.orderDate,
                        }}
                        compact
                      />
                      <CreateTicketButton
                        customers={[customer]}
                        employees={employees}
                        customerId={customer.id}
                        orderCode={order.code}
                        compact
                      />
                    </footer>
                  </article>
                ))}
                {!orders.length && <p className="no-data">Chưa có đơn hàng.</p>}
              </div>
            </section>
          )}
          {selected === "reminders" && (
            <section className="panel profile-panel">
              <div className="panel-head">
                <div>
                  <h2>Lịch nhắc chăm sóc</h2>
                  <p>Các lịch chỉ hết cảnh báo sau khi hoàn thành.</p>
                </div>
                <CreateCareButton
                  customers={[customer]}
                  employees={employees}
                  customerId={customer.id}
                />
              </div>
              <div className="profile-reminders">
                {tasks.map((task) => (
                  <article key={task.id}>
                    <div>
                      <StatusPill status={task.status} />
                      <h3>{task.purpose}</h3>
                      <p>
                        {new Date(task.dueAt).toLocaleString("vi-VN", {
                          timeZone: "Asia/Bangkok",
                        })}{" "}
                        · {task.channel} · {task.owner}
                        {task.orderId && ` · Đơn ${task.orderId}`}
                      </p>
                    </div>
                    <CareTaskActions task={task} employees={employees} />
                  </article>
                ))}
                {!tasks.length && (
                  <p className="no-data">Chưa có lịch nhắc chăm sóc.</p>
                )}
              </div>
            </section>
          )}
          {selected === "care" && (
            <section className="panel profile-panel">
              <div className="panel-head">
                <div>
                  <h2>Lịch sử chăm sóc</h2>
                  <p>Toàn bộ tương tác được lưu theo mốc thời gian.</p>
                </div>
                <CreateActivityButton
                  customerId={customer.id}
                  orders={orders}
                />
              </div>
              <div className="timeline">
                {activities.map((activity) => (
                  <article key={activity.id}>
                    <div className="timeline-marker">
                      <MessageSquareText size={15} />
                    </div>
                    <div className="timeline-card">
                      <header>
                        <div>
                          <strong>
                            Lần {activity.careAttempt || "—"} ·{" "}
                            {activity.purpose}
                          </strong>
                          <span>
                            {new Date(activity.occurredAt).toLocaleString(
                              "vi-VN",
                              { timeZone: "Asia/Bangkok" },
                            )}
                            {activity.orderId && ` · Đơn ${activity.orderId}`}
                          </span>
                        </div>
                        <i>{activity.channel}</i>
                      </header>
                      <p>
                        <b>Kết quả:</b> {activity.result} · <b>Liên lạc:</b>{" "}
                        {activity.contactStatus}
                      </p>
                      {activity.note && (
                        <blockquote>{activity.note}</blockquote>
                      )}
                      <footer>
                        <span>Nhân viên: {activity.employee}</span>
                        {activity.satisfaction && (
                          <span>
                            Hài lòng: {"★".repeat(activity.satisfaction)}
                            {"☆".repeat(5 - activity.satisfaction)}
                          </span>
                        )}
                        {activity.adverseReaction && (
                          <span className="danger-text">
                            Có phản ứng bất thường
                          </span>
                        )}
                      </footer>
                    </div>
                  </article>
                ))}
                {!activities.length && (
                  <p className="no-data">Chưa có lịch sử chăm sóc.</p>
                )}
              </div>
            </section>
          )}
          {selected === "tickets" && (
            <section className="panel ticket-card">
              <div className="panel-head">
                <div>
                  <h2>Phiếu yêu cầu</h2>
                  <p>Tạo, theo dõi và đóng/mở phiếu theo khách hàng.</p>
                </div>
                <CreateTicketButton
                  customers={[customer]}
                  employees={employees}
                  customerId={customer.id}
                />
              </div>
              {tickets.map((ticket) => (
                <article key={ticket.id}>
                  <div>
                    <strong>{ticket.id}</strong>
                    <span
                      className={`priority ${ticket.priority === "Khẩn cấp" ? "urgent" : ""}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                  <p>{ticket.title}</p>
                  <footer>
                    {ticket.status} · {ticket.owner}
                  </footer>
                </article>
              ))}
              {!tickets.length && (
                <p className="no-data">Chưa có phiếu yêu cầu.</p>
              )}
            </section>
          )}
        </main>
        <aside className="profile-side">
          <section className="panel info-card">
            <div className="panel-head">
              <h2>Thông tin khách hàng</h2>
            </div>
            <dl>
              <div>
                <dt>
                  <UserRound />
                  Phân nhóm
                </dt>
                <dd>{customer.segment}</dd>
              </div>
              <div>
                <dt>
                  <MapPin />
                  Mục tiêu sức khỏe
                </dt>
                <dd>{customer.healthGoal}</dd>
              </div>
              <div>
                <dt>
                  <Phone />
                  Điện thoại
                </dt>
                <dd>{customer.phone}</dd>
              </div>
              <div>
                <dt>
                  <CalendarPlus />
                  Lịch tiếp theo
                </dt>
                <dd>{customer.nextCare}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
