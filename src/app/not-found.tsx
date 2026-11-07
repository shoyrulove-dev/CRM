import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel empty-state">
      <h2>Không tìm thấy nội dung</h2>
      <p>
        Thông tin này có thể đã được thay đổi hoặc đường dẫn không còn đúng.
      </p>
      <Link className="primary-button" href="/">
        Về trang tổng quan
      </Link>
    </section>
  );
}
