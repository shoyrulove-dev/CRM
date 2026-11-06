import { redirect } from "next/navigation";
import { AccountManager } from "@/components/account-manager";
import { GroupManager } from "@/components/group-manager";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/users";
import { getDatabase } from "@/lib/mongodb";
import { collections } from "@/lib/data-store";
import type { PermissionGroup } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function AccountsPage() {
  const current = await getCurrentUser();
  if (current?.role !== "admin") redirect("/");
  const [users, groups] = await Promise.all([
    listUsers(),
    getDatabase().then((db) =>
      db
        .collection(collections.permissionGroups)
        .find({}, { projection: { _id: 0 } })
        .toArray(),
    ),
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
    </>
  );
}
