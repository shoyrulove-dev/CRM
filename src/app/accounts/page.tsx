import { redirect } from "next/navigation";
import { AccountManager } from "@/components/account-manager";
import { GroupManager } from "@/components/group-manager";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/users";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import type { PermissionGroup } from "@/lib/types";
import { canOpenAccounts } from "@/lib/account-access";
export const dynamic = "force-dynamic";
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ loginPage?: string }>;
}) {
  const current = await getCurrentUser();
  if (!canOpenAccounts(current)) redirect("/");
  const requestedPage = Number((await searchParams).loginPage || 1);
  const loginPage = Number.isFinite(requestedPage)
    ? Math.max(1, requestedPage)
    : 1;
  const pageSize = 15;
  const [allUsers, groups, loginData] = await Promise.all([
    listUsers(),
    hasDatabase()
      ? getDatabase().then((db) =>
          db
            .collection(collections.permissionGroups)
            .find({}, { projection: { _id: 0 } })
            .toArray(),
        )
      : Promise.resolve([]),
    hasDatabase()
      ? getDatabase().then(async (db) => ({
          events: await db
            .collection(collections.loginEvents)
            .find({}, { projection: { _id: 0 } })
            .sort({ createdAt: -1 })
            .skip((loginPage - 1) * pageSize)
            .limit(pageSize)
            .toArray(),
          total: await db.collection(collections.loginEvents).countDocuments(),
        }))
      : Promise.resolve({ events: [], total: 0 }),
  ]);
  const users = current?.role === "super_admin"
    ? allUsers
    : allUsers.filter((user) => ["sales", "care"].includes(user.role));
  const loginEvents = loginData.events;
  const totalPages = Math.max(1, Math.ceil(loginData.total / pageSize));
  if (loginPage > totalPages) redirect(`/accounts?loginPage=${totalPages}`);
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">NHÂN SỰ VÀ PHÂN QUYỀN</p>
          <h1>Tài khoản nhân viên</h1>
          <p>Tạo tài khoản, nhóm quyền và kiểm soát truy cập theo công việc.</p>
        </div>
      </div>
      <AccountManager users={users as never} groups={groups as never} currentRole={current!.role} />
      {current?.role === "super_admin" && <GroupManager initial={groups as unknown as PermissionGroup[]} />}
      <section className="panel login-history">
        <div className="panel-head">
          <div>
            <h2>Lịch sử đăng nhập</h2>
            <p>
              Theo dõi cả lần đăng nhập thành công và không thành công.
            </p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>THỜI GIAN</th>
                <th>TÀI KHOẢN</th>
                <th>ĐỊA CHỈ IP</th>
                <th>KẾT QUẢ</th>
                <th>GHI CHÚ</th>
              </tr>
            </thead>
            <tbody>
              {loginEvents.map((event) => (
                <tr key={String(event.id)}>
                  <td>
                    {new Date(String(event.createdAt)).toLocaleString("vi-VN", {
                      timeZone: "Asia/Bangkok",
                    })}
                  </td>
                  <td>
                    <strong>{String(event.userName || event.email)}</strong>
                    <small>{String(event.email)}</small>
                  </td>
                  <td>{String(event.ip)}</td>
                  <td>
                    <span
                      className={`account-state ${event.success ? "on" : "off"}`}
                    >
                      {event.success ? "Thành công" : "Không thành công"}
                    </span>
                  </td>
                  <td>{String(event.reason || "")}</td>
                </tr>
              ))}
              {!loginEvents.length && (
                <tr>
                  <td colSpan={5}>Chưa có lịch sử đăng nhập.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <nav className="login-pagination" aria-label="Phân trang lịch sử đăng nhập">
          <span>
            {loginData.total
              ? `${(loginPage - 1) * pageSize + 1}–${Math.min(loginPage * pageSize, loginData.total)} / ${loginData.total}`
              : "0 bản ghi"}
          </span>
          <div>
            {loginPage > 1 && <a href={`/accounts?loginPage=${loginPage - 1}`}>Trước</a>}
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((page) => Math.abs(page - loginPage) <= 2)
              .map((page) => (
                <a key={page} href={`/accounts?loginPage=${page}`} className={page === loginPage ? "active" : ""}>
                  {page}
                </a>
              ))}
            {loginPage < totalPages && <a href={`/accounts?loginPage=${loginPage + 1}`}>Sau</a>}
          </div>
        </nav>
      </section>
    </>
  );
}
