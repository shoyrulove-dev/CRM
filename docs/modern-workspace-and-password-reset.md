# Giao diện và khôi phục tài khoản — 15/11/2026

- Không thay đổi dữ liệu, lịch đồng bộ Haravan, R2 hoặc phạm vi phân quyền.
- Khung SaaS mới: thanh bên thu gọn, Tổng quan ưu tiên công việc, bảng phân trang, biểu mẫu dạng ngăn bên phải, bàn phím Esc và giữ focus trong biểu mẫu.
- Cỡ chữ trong bộ CSS cũ tăng 20%; bộ kiểu mới dùng các mức tương ứng, điều chỉnh responsive cho điện thoại.
- Super Admin cấu hình Resend tại Cài đặt → Email khôi phục mật khẩu. API key được mã hóa cùng cấu hình kết nối; không gửi key xuống trình duyệt. Có thể dùng cùng cấu hình gửi của Hub nhưng lưu độc lập trong CRM.
- Đường dẫn `/reset-password`: nhập email tài khoản. Liên kết có token ngẫu nhiên 256 bit, đặt trong fragment, chỉ lưu SHA-256 trong DB, hiệu lực 30 phút và tiêu thụ nguyên tử một lần. Không có tài khoản vẫn trả cùng thông báo. Có giới hạn theo IP và thời gian giữa hai email cho một tài khoản.
- Đổi mật khẩu qua liên kết tăng phiên bản phiên đăng nhập, thu hồi phiên cũ và xóa khóa do nhập sai. Chỉ tài khoản hoạt động, chưa lưu trữ được khôi phục.
- Tạo tài khoản: có thể nhập mật khẩu tạm hoặc để trống để tự tạo. Mật khẩu tạm chỉ hiện một lần sau khi tạo và không lưu dạng rõ. Bắt buộc đổi trước khi truy cập nghiệp vụ, áp dụng cả API. Admin đặt lại mật khẩu cũng buộc người nhận đổi ở lần đăng nhập sau.
- Super Admin đổi mật khẩu cá nhân ở menu góc phải; không đặt lại tài khoản Super Admin từ bảng nhân viên.

Kiểm tra gửi thư: dùng email nhận thử do chủ hệ thống cấu hình. Không gửi thử đến email khách hàng. Việc Resend chấp nhận thư không đồng nghĩa đã vào hộp thư chính; cần kiểm tra trạng thái giao thư và thư rác.

Tài liệu nhà cung cấp: https://resend.com/docs/api-reference/emails/send-email
