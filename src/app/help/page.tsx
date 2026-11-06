import { CalendarClock, ChartNoAxesCombined, CircleHelp, TicketCheck, UsersRound } from "lucide-react";

const guides = [
  { icon: UsersRound, title: "Quản lý khách hàng", text: "Tìm khách theo tên hoặc số điện thoại, mở hồ sơ để xem đơn hàng và ghi lại từng lần chăm sóc." },
  { icon: CalendarClock, title: "Lịch chăm sóc", text: "Tạo lịch một lần hoặc định kỳ. Lịch quá hạn vẫn được giữ lại cho đến khi bạn chọn Hoàn thành." },
  { icon: TicketCheck, title: "Phiếu yêu cầu", text: "Ghi nhận phản ánh hoặc yêu cầu của khách, chọn người phụ trách và cập nhật trạng thái trong quá trình xử lý." },
  { icon: ChartNoAxesCombined, title: "Báo cáo", text: "Chọn khoảng thời gian để xem kết quả theo nhân viên, tỷ lệ liên lạc, tái mua và tải báo cáo Excel." },
];

export default function HelpPage() {
  return <><div className="page-heading compact"><div><p className="eyebrow">HƯỚNG DẪN SỬ DỤNG</p><h1>Trợ giúp</h1><p>Các thao tác thường dùng trong hệ thống chăm sóc khách hàng.</p></div></div><div className="settings-grid">{guides.map(item=>{const Icon=item.icon;return <section className="panel setting-card" key={item.title}><span className="integration-logo hara"><Icon/></span><div><h2>{item.title}</h2><p>{item.text}</p></div></section>})}<section className="panel setting-card"><span className="integration-logo mongo"><CircleHelp/></span><div><h2>Khi cần hỗ trợ</h2><p>Chụp lại màn hình, ghi rõ khách hàng hoặc mã phiếu đang thao tác và gửi cho người quản trị hệ thống.</p></div></section></div></>;
}
