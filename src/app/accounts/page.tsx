import { redirect } from "next/navigation";
import { AccountManager } from "@/components/account-manager";
import { GroupManager } from "@/components/group-manager";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/users";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import type { PermissionGroup } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function AccountsPage() {
  const current = await getCurrentUser();
  if (current?.role !== "admin") redirect("/");
  const [users, groups, loginEvents] = await Promise.all([
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
      ? getDatabase().then((db) =>
          db
            .collection(collections.loginEvents)
            .find({}, { projection: { _id: 0 } })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray(),
        )
      : Promise.resolve([]),
  ]);
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">NHÂN SỰ VÀ PHÂN QUYỀN</p>
          <h1>Tài khoản nhân viên</h1>
          <p>Tạo tài khoản, nhóm quyền và kiểm soát truy cập theo công việc.</p>
        </div>
      </div>
      <AccountManager users={users as never} groups={groups as never} />
      <GroupManager initial={groups as unknown as PermissionGroup[]} />
      <section className="panel login-history">
        <div className="panel-head">
          <div>
            <h2>Lịch sử đăng nhập</h2>
            <p>
              50 lần đăng nhập gần nhất, gồm cả thành công và không thành công.
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
      </section>
    </>
  );
}
