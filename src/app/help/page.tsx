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
      "Dùng bộ chọn Từ tháng / Đến tháng hoặc Tháng này / Tháng trước để lọc. Với khách hàng, khoảng tháng áp dụng cho đơn gần nhất; Sắp xếp là lựa chọn riêng.",
      "Nếu chọn ngày cụ thể, hệ thống ưu tiên ngày đó thay cho khoảng tháng. Chọn Tháng này hoặc Tháng trước sẽ bỏ ngày cụ thể; Xóa lọc đưa danh sách về mặc định.",
      "Phân nhóm gồm Chưa xác định, Trung thành và Vãng lai. Nhãn cũ được giữ lại cho đến khi bạn chủ động chọn nhãn mới.",
    ],
  },
  {
    icon: CalendarClock,
    title: "Tạo lịch chăm sóc",
    steps: [
      "Mở Lịch chăm sóc → chọn Tạo lịch chăm sóc.",
      "Chọn ngày giờ cụ thể, hoặc chọn một ngày gốc rồi nhập số ngày cần nhắc.",
      "Lịch quá hạn vẫn còn trên hàng đợi cho đến khi bấm Hoàn thành.",
      "Tạo hàng loạt: chọn tệp khách ở bộ lọc riêng. Giao theo nhân viên phụ trách sẽ tự lấy người trong từng hồ sơ, không cần chọn người nhận việc nữa. Khách chưa phân công vẫn hiện rõ để admin xử lý.",
      "Chọn chu kỳ tuần, tháng, quý, năm hoặc số ngày tùy chỉnh. Lịch đơn tạo kỳ kế tiếp khi hoàn thành; chương trình hàng loạt tạo theo lịch ngày độc lập với việc hoàn thành.",
      "Mở Chương trình chăm sóc để xem tiến độ, sửa nội dung, tạm dừng hoặc kết thúc; lịch đã giao không bị xóa. Sửa chỉ áp dụng cho các lượt chưa tạo. Tệp khách được chốt khi tạo chương trình.",
      "Trong Chương trình chăm sóc → Cài đặt lịch tự động, admin có thể bật/tắt nguồn đơn hàng, sinh nhật, ngày lễ; thêm hoặc bỏ nội dung nhắc sau mua. Sau khi dọn dữ liệu cũ, các nguồn này tạm tắt cho đến khi admin cài lại.",
      "Import Excel: chọn từng dòng hoặc Chọn tất cả dòng có thể nhập. Dòng cảnh báo cần tích xác nhận riêng; chỉ tích xác nhận mà chưa chọn dòng thì nút vẫn là Nhập 0 dòng.",
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
      "Khách và đơn trong kỳ cùng dùng khoảng ngày/nhân viên đã chọn. Chỉ số lũy kế được ghi riêng; doanh thu mua lại là giá trị đơn tái mua, không tự quy là doanh thu do chăm sóc tạo ra.",
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
      "Mở Cài đặt → Haravan, dán Token Private App rồi chọn Lưu Token.",
      "Chọn Kiểm tra kết nối; khi bốn mục đều màu xanh, chọn Đồng bộ dữ liệu ngay.",
      "VPS kiểm tra đồng bộ khách/đơn theo lịch nền khoảng 5 phút. Hạng và điểm từng khách được làm mới khoảng 24 giờ, không phải realtime; trong hồ sơ có nút Cập nhật hạng/điểm khi cần số mới.",
      "Sau khi lưu, kiểm tra trạng thái kết nối trước khi đồng bộ đơn hàng thật.",
      "Chọn Đồng bộ hạng/điểm V2 để lấy dữ liệu thành viên qua API chi tiết khách hàng bằng token đã lưu. Giữ trang mở để chạy tiếp các lô; có thể dừng sau lô hiện tại. Chưa đồng bộ không đồng nghĩa với 0 điểm; lỗi đọc không xóa dữ liệu cũ.",
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
