import { hash } from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { collections } from "@/lib/data-store";
import { getDatabase, hasDatabase } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/current-user";
export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const current=await getCurrentUser(); if(current?.role!=="admin") return NextResponse.json({error:"Bạn không có quyền cập nhật tài khoản."},{status:403});
  if(!hasDatabase()) return NextResponse.json({error:"Kho dữ liệu chưa sẵn sàng."},{status:503});
  const {id}=await params,body=await request.json().catch(()=>null),update:Record<string,unknown>={updatedAt:new Date().toISOString()};
  if(body?.name) update.name=String(body.name).trim(); if(['admin','sales','care'].includes(body?.role)) update.role=body.role; if(typeof body?.active==='boolean') update.active=body.active;
  if(typeof body?.groupId==='string') update.groupId=body.groupId;
  if(body?.password){if(String(body.password).length<8)return NextResponse.json({error:"Mật khẩu cần ít nhất 8 ký tự."},{status:400});update.passwordHash=await hash(String(body.password),10);}
  if(id===current.id&&update.active===false)return NextResponse.json({error:"Bạn không thể tự khóa tài khoản đang sử dụng."},{status:400});
  const result=await (await getDatabase()).collection(collections.users).findOneAndUpdate({id},{$set:update},{returnDocument:'after',projection:{_id:0,passwordHash:0}});
  return result?NextResponse.json({data:result}):NextResponse.json({error:"Không tìm thấy tài khoản."},{status:404});
}
