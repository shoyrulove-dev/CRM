# Rà lỗi và tối ưu tải CRM — 19/11/2026

## Phạm vi và phép đo

- Cập nhật CRM hiện hữu trên VPS Nichiei 103.118.29.93, /opt/NichieiCRM. Không thay domain/cổng, token Haravan hay restart MongoDB/NikiFX/Hub.
- Đo bằng phiên xác thực ngắn hạn tại localhost bên trong container: 4 lượt GET cho mỗi đường dẫn, ghi riêng lượt đầu; median của 3 lượt sau dùng so sánh. Đọc hết response body, không log payload khách hoặc thông tin xác thực.
- Đây là thời gian phản hồi HTTP của ứng dụng, không phải LCP hoặc thời gian tải hoàn chỉnh trên mạng người dùng. Phép đo trước/sau không thực hiện đồng thời, có nhiễu tải VPS; không tuyên bố mọi trang đều nhanh hơn.
- Caddy đã có gzip trước đợt tối ưu. Không bật public cache cho dữ liệu CRM hoặc cache chung dữ liệu giữa các tài khoản.

## Kết quả thực đo

### Admin

| Luồng | Trước (ms) | Sau (ms) | Dung lượng trước → sau |
|---|---:|---:|---|
| Tổng quan | 146,2 | 123,7 | 53,6 KB → 53,6 KB |
| Khách hàng | 137,2 | 131,5 | 234,5 KB → 234,5 KB |
| Lịch chăm sóc | 163,5 | 126,2 | 262,2 KB → 262,2 KB |
| Phiếu yêu cầu | 78,0 | 60,7 | 189,7 KB → 189,7 KB |
| Báo cáo | 772,8 | 309,4 | 53,6 KB → 53,6 KB |
| Thông báo | 37,1 | 11,8 | 9,1 KB → 4,9 KB |
| Dữ liệu mở biểu mẫu CSKH | 873,4 | 57,8 | 7.048.472 byte → 329.564 byte |

Dữ liệu mở biểu mẫu giảm **95,3%**; chỉ tải đơn hàng của khách được chọn trong request riêng. Số đo trên không bao gồm request đơn hàng thứ hai hoặc chi phí render dropdown.

### Sale

| Luồng | Trước (ms) | Sau (ms) |
|---|---:|---:|
| Tổng quan | 57,6 | 53,9 |
| Khách hàng | 91,0 | 87,6 |
| Lịch chăm sóc | 100,6 | 104,4 |
| Phiếu yêu cầu | 51,4 | 48,7 |
| Báo cáo | 735,2 | 114,2 |
| Thông báo | 15,8 | 10,5 |
| Dữ liệu mở biểu mẫu CSKH | 713,3 | 26,5 |

Dung lượng biểu mẫu sale: 1.724.132 → 79.692 byte. Lịch chăm sóc sale có dao động tăng nhỏ; không báo cáo đây là cải thiện. Lượt đầu Tổng quan admin cũng dao động 339,8 → 440 ms, nên không suy từ số liệu warm ra cam kết cold-load.

## Nguyên nhân đã xử lý

1. Biểu mẫu trước đây gọi bộ đọc báo cáo đầy đủ rồi tải toàn bộ khách/đơn. Nay chỉ trả bốn trường khách cần dùng và tải đơn hàng đúng khách sau khi kiểm tra quyền. Hủy request cũ khi đổi khách; có trạng thái tải, lỗi và thử lại, không cho lưu khi đơn hàng chưa sẵn sàng.
2. Báo cáo trước đây tải cả năm collection, gồm task/đơn với nhiều trường nặng rồi mới lọc quyền trong bộ nhớ. Nay áp scope tại MongoDB, dùng projection tóm tắt, bỏ collection không dùng. Xuất Excel chỉ đọc các collection đúng mẫu xuất.
3. Thêm 8 chỉ mục đọc; không xóa chỉ mục cũ. Truy vấn danh sách khách 20 dòng: docs examined 3.707 → 20, không còn SORT chặn. Truy vấn thông báo: keys examined 7.215 → 20, không còn SORT chặn.
4. Mặc định không lọc trạng thái khách: tái sử dụng kết quả tổng hợp để tránh quét cùng dữ liệu hai lần. Khi lọc trạng thái vẫn tính chip đếm độc lập.
5. Tìm kiếm khách được escape thành chuỗi literal và giới hạn độ dài; các ký tự như dấu ngoặc không còn gây lỗi regex hoặc được coi là biểu thức tùy ý.
6. Bộ lọc nhân viên áp dụng cả lượt chăm sóc, đơn, nhiệm vụ và kỳ so sánh trước. Ngày báo cáo/xuất dùng ngày Việt Nam; khoảng ngày sai trả cảnh báo/400 thay vì lỗi máy chủ. Sửa ngày mua bị lệch ngày khi server chạy UTC và tránh lệch giờ SSR/client ở trạng thái đồng bộ.
7. Chặn khôi phục tự động tài khoản có mật khẩu demo khi đọc danh sách hoặc login production. Không đổi/khóa tài khoản đang tồn tại.
8. Mã tạo khách/nhật ký/nhóm không còn cắt 6 số thời gian (lặp sau 1.000.000 ms); dùng UUID cho bản ghi mới, không đổi mã lịch sử.
9. Bổ sung catch/finally cho ghi nhận chăm sóc, tạo lịch hàng loạt, cài đặt kết nối và thông báo; không khóa nút khi mất mạng, không đánh dấu đã xem giả khi API lỗi. Chuẩn hóa ngày giờ lịch hàng loạt sang ISO từ giờ local của trình duyệt.
10. Đồng bộ Haravan lưu cố định chế độ/bộ lọc của chu kỳ đang chạy, tiếp tục đúng trang; không chuyển từ tập cập nhật sang tập toàn bộ giữa chừng. Watermark lấy thời điểm bắt đầu chu kỳ hoàn tất để không bỏ khoảng thời gian xử lý. Có khóa chống chạy chồng theo chủ sở hữu.
11. Đối soát lịch không dùng các nhật ký lịch sử Excel để tự sinh/đổi lịch chăm hiện tại và không kéo lùi ngày chăm gần nhất. Parser Excel chặn cả ngày ISO sai lịch như 31/02.

## Kiểm tra và an toàn triển khai

- 10 kiểm thử hiệu năng/đọc/quyền/checkpoint/ID, 10 import, 14 Loyalty: **34 kiểm thử đạt**.
- 18 E2E desktop/mobile: import, tạo khách/thử lại/phân trang, tải đơn theo khách, thử lại tải đơn và khoảng ngày báo cáo sai: **18 đạt**. Các thao tác ghi thử được giả lập, không nhập dữ liệu thử lên production.
- Typecheck, lint và build local/VPS đạt. Một lượt lint gặp lỗi đọc file tạm thời trên Windows; chạy lại đã đạt.
- Kiểm tra live admin và sale: payload tối giản, scope khách/đơn, chặn xem đơn khách ngoài phạm vi, tìm ký tự đặc biệt, báo cáo/xuất sai ngày đều đạt.
- Số bản ghi trước/sau: customers 3.707; care_tasks 16.991; care_activities 3; orders 5.986; service_tickets 5. Không xóa hoặc tái nhập dữ liệu nghiệp vụ trong kiểm tra hiệu năng.
- Sao lưu: /var/backups/nichiei-performance-20261119T0613. Image trước cập nhật: nichieicrm-crm:before-performance-20261119. Các chỉ mục mới chỉ bổ sung, rollback image cũ vẫn dùng được.

## Các giới hạn còn lại

- Một khách Haravan V2 trả 422 vẫn là ngoại lệ phía API; đợt tối ưu không tự suy ra hạng/điểm để lấp dữ liệu.
- Chưa xác nhận hiệu năng ở mạng di động thực, Safari thực hoặc tải đồng thời lớn. Chưa làm kiểm thử tải gây áp lực trên VPS dùng chung.
- Không coi rà soát này là bảo đảm ứng dụng không còn bất kỳ lỗi nào. Các công cụ đo và kiểm tra trong scripts có thể dùng lại cho lần kiểm tra sau.
