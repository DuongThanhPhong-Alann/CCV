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

MongoDB lưu tài khoản trong collection `users` và sơ đồ trong `diagrams`. Đừng đưa thông tin kết nối thật vào Git.
