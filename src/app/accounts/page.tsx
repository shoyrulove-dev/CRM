import { redirect } from "next/navigation";
import { AccountManager } from "@/components/account-manager";
import { getCurrentUser } from "@/lib/current-user";
import { listUsers } from "@/lib/users";
export const dynamic="force-dynamic";
export default async function AccountsPage(){const current=await getCurrentUser();if(current?.role!=="admin")redirect('/');const users=await listUsers();return <><div className="page-heading compact"><div><p className="eyebrow">NHÂN SỰ VÀ PHÂN QUYỀN</p><h1>Tài khoản nhân viên</h1><p>Tạo tài khoản, phân nhóm công việc và khóa quyền truy cập khi cần.</p></div></div><AccountManager users={users as never}/></>}
