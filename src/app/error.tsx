"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="panel empty-state"><h2>Chưa thể tải nội dung</h2><p>Hệ thống đang gặp gián đoạn tạm thời. Bạn có thể thử tải lại hoặc quay lại sau ít phút.</p><button className="primary-button" onClick={reset}>Thử lại</button></section>;
}
