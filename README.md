# ERD Draw

Ứng dụng Next.js để tạo sơ đồ ERD, đăng ký tài khoản và lưu nhiều sơ đồ riêng cho từng người dùng vào MongoDB.

## Cấu hình MongoDB

1. Tạo MongoDB local hoặc MongoDB Atlas.
2. Sao chép `.env.example` thành `.env.local`.
3. Điền `MONGODB_URI`, tên database và `NEXTAUTH_SECRET` của bạn. Có thể tạo secret bằng Node.js:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Cài dependencies và chạy ứng dụng:

   ```powershell
   npm install
   npm run dev
   ```

Mở `http://localhost:3000`. Sau khi thay đổi `.env.local`, hãy khởi động lại dev server.

## Tài khoản và sơ đồ

- Đăng ký bằng tên, email và mật khẩu; mật khẩu được băm trước khi lưu.
- Người dùng chỉ xem, sửa và xóa sơ đồ thuộc tài khoản của mình.
- Tạo sơ đồ mới yêu cầu nhập tên trước khi mở canvas.
- Tên sơ đồ sửa trực tiếp ở thanh trên. Thay đổi được tự động lưu lên MongoDB sau thao tác.
- Trong editor có thể xuất script PostgreSQL, MongoDB hoặc Supabase.

## Bài tập

- Mọi tài khoản đều có thể giao bài bằng email của một tài khoản ERD Draw khác.
- Người nhận xem lời mời trong tab **Được giao**, rồi chấp nhận hoặc từ chối.
- Chấp nhận bài sẽ tạo một sơ đồ trắng gắn với bài tập. Người làm có thể tiếp tục sửa sau khi nộp và gửi lại nhiều lần.
- Mỗi lần nộp lưu một phiên bản riêng. Người giao xem nội dung bài nộp, chấm từ 0 đến 10 và gửi nhận xét.
- Tab **Đã giao** giúp người giao theo dõi phản hồi, bài nộp và kết quả.

MongoDB lưu tài khoản trong collection `users`, sơ đồ trong `diagrams` và lời mời/bài nộp trong `tasks`. Đừng đưa thông tin kết nối thật vào Git.
