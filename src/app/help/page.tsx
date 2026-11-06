import {
  CalendarClock,
  ChartNoAxesCombined,
  TicketCheck,
  UsersRound,
  UserCog,
  ShoppingBag,
} from "lucide-react";
const guides = [
  {
    icon: UsersRound,
    title: "Thêm và theo dõi khách hàng",
    steps: [
      "Mở Khách hàng → chọn Thêm khách hàng.",
      "Nhập tên, số điện thoại, ngày sinh, người phụ trách và mục tiêu sức khỏe.",
      "Chọn Xem tại một khách để mở đơn hàng, nhật ký chăm sóc và phiếu yêu cầu.",
    ],
  },
  {
    icon: CalendarClock,
    title: "Tạo lịch chăm sóc",
    steps: [
      "Mở Lịch chăm sóc → chọn Tạo lịch chăm sóc.",
      "Chọn ngày giờ cụ thể, hoặc chọn một ngày gốc rồi nhập số ngày cần nhắc.",
      "Lịch quá hạn vẫn còn trên hàng đợi cho đến khi bấm Hoàn thành.",
    ],
  },
  {
    icon: TicketCheck,
    title: "Xử lý yêu cầu khách hàng",
    steps: [
      "Trong hồ sơ khách hoặc trang Phiếu yêu cầu, chọn Tạo phiếu.",
      "Ghi nội dung, mức ưu tiên và người phụ trách.",
      "Chuyển trạng thái Mới → Đang xử lý → Chờ khách hoặc Đã đóng.",
    ],
  },
  {
    icon: ChartNoAxesCombined,
    title: "Xem và xuất báo cáo",
    steps: [
      "Mở Báo cáo và chọn khoảng ngày cần xem.",
      "Quản trị xem toàn đội; nhân viên chỉ xem kết quả của mình.",
      "Chọn Tải báo cáo Excel để gửi hoặc lưu trữ.",
    ],
  },
  {
    icon: UserCog,
    title: "Quản lý tài khoản",
    steps: [
      "Chỉ Quản trị mới nhìn thấy mục Tài khoản.",
      "Dùng các tab để lọc Quản trị, Bán hàng hoặc Chăm sóc.",
      "Nút Sửa đổi nhóm quyền; Mật khẩu đặt lại mật khẩu; Khóa ngừng quyền đăng nhập.",
    ],
  },
  {
    icon: ShoppingBag,
    title: "Kết nối Haravan",
    steps: [
      "Mở Cài đặt → Haravan và nhập tên cửa hàng, khóa truy cập, khóa xác thực.",
      "Sao chép địa chỉ nhận dữ liệu hiển thị tại màn hình để khai báo webhook.",
      "Sau khi lưu, kiểm tra trạng thái kết nối trước khi đồng bộ đơn hàng thật.",
    ],
  },
];
export default function HelpPage() {
  return (
    <>
      <div className="page-heading compact">
        <div>
          <p className="eyebrow">HƯỚNG DẪN THAO TÁC</p>
          <h1>Trợ giúp sử dụng CRM</h1>
          <p>Chọn đúng công việc và làm lần lượt theo từng bước bên dưới.</p>
        </div>
      </div>
      <div className="help-grid">
        {guides.map((g, n) => {
          const Icon = g.icon;
          return (
            <section className="panel help-card" key={g.title}>
              <header>
                <span>
                  <Icon />
                </span>
                <div>
                  <small>HƯỚNG DẪN {n + 1}</small>
                  <h2>{g.title}</h2>
                </div>
              </header>
              <ol>
                {g.steps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
      <section className="panel help-support">
        <b>Khi gặp lỗi:</b> chụp toàn bộ màn hình, ghi tên khách hàng hoặc mã
        phiếu, thời điểm xảy ra và thao tác ngay trước khi lỗi xuất hiện rồi gửi
        cho quản trị hệ thống.
      </section>
    </>
  );
}
