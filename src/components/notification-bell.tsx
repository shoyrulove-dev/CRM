"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [count,setCount]=useState(0);
  useEffect(()=>{let active=true;fetch("/api/care").then(response=>response.ok?response.json():null).then(result=>{if(!active||!result?.data)return;const today=new Date().toISOString().slice(0,10);setCount(result.data.filter((item:{status:string;dueAt:string})=>item.status!=="done"&&(item.status==="overdue"||item.dueAt.slice(0,10)<=today)).length)}).catch(()=>{});return()=>{active=false}},[]);
  return <Link className="icon-button notification" href="/care" aria-label={count?`${count} lịch chăm sóc cần xử lý`:"Không có lịch chăm sóc cần xử lý"}><Bell size={20}/>{count>0&&<b className="notification-count">{count>99?"99+":count}</b>}</Link>;
}
