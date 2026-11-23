# ERD Draw

Ứng dụng Next.js để tạo sơ đồ ERD, quản lý bài tập và lưu dữ liệu riêng theo tài khoản. Supabase là CSDL chính; MongoDB giữ bản sao dự phòng.

## Cấu hình Supabase và MongoDB

1. Tạo một project Supabase và một MongoDB local hoặc MongoDB Atlas.
2. Sao chép `.env.example` thành `.env.local`, rồi điền `MONGODB_URI`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` và `NEXTAUTH_SECRET`. Supabase secret key chỉ dùng phía máy chủ; không đặt nó trong biến `NEXT_PUBLIC_*`.
3. Chạy nội dung [`supabase/migrations/20261123000000_create_mongo_mirror_tables.sql`](supabase/migrations/20261123000000_create_mongo_mirror_tables.sql) trong Supabase SQL Editor để tạo các bảng `users`, `diagrams`, `tasks`.
4. Chuyển dữ liệu hiện có từ MongoDB sang Supabase:

   ```powershell
   npm run migrate:supabase
   ```

   Tạm dừng ứng dụng trong lúc chuyển dữ liệu để tránh ghi đè thay đổi phát sinh đồng thời. Lệnh đọc MongoDB, giữ nguyên ID và tải users, diagrams, tasks lên Supabase. Có thể chạy lại nếu lệnh bị gián đoạn; các bản ghi đã có trên Supabase sẽ được giữ nguyên.
5. Cài dependencies và chạy ứng dụng:

   ```powershell
   npm install
   npm run dev
   ```

Mở `http://localhost:3000`. Sau khi thay đổi `.env.local`, hãy khởi động lại dev server.

## Cách đồng bộ dữ liệu

- Các truy vấn đọc Supabase trước. MongoDB được dùng để đọc dự phòng khi Supabase không truy cập được; kết quả rỗng từ Supabase được xem là kết quả chính, nên hãy chuyển dữ liệu trước khi đưa ứng dụng lên dùng.
- Mỗi lần ghi sẽ lưu vào Supabase và phản chiếu sang MongoDB. Nếu một bên tạm thời lỗi, ứng dụng ghi vào bên còn lại và thử đồng bộ lại ở các truy vấn tiếp theo.
- Đăng nhập tài khoản mật khẩu cũng đọc hồ sơ từ Supabase trước. Phiên đăng nhập dùng JWT.
- Chưa cấu hình Supabase thì ứng dụng vẫn dùng MongoDB để giữ khả năng chạy ở môi trường cũ.

## Tài khoản và sơ đồ

- Đăng ký bằng tên, email và mật khẩu; mật khẩu được băm trước khi lưu.
- Người dùng chỉ xem, sửa và xóa sơ đồ thuộc tài khoản của mình.
- Tạo sơ đồ mới yêu cầu nhập tên trước khi mở canvas.
- Tên sơ đồ sửa trực tiếp ở thanh trên. Thay đổi được tự động lưu lên cả hai CSDL.
- Trên điện thoại, chụm hai ngón để phóng/thu và kéo nền trống để di chuyển canvas; nút +/- vẫn dùng được trên mọi thiết bị.
- Nối quan hệ N:M tự tạo bảng trung gian ở giữa hai bảng. Trong editor có thể xuất script PostgreSQL, MongoDB hoặc Supabase.

## Bài tập

- Đề bài được lưu trong **Kho đề**; mỗi lần giao tạo một lượt làm bài riêng nên có thể giao cho nhiều người hoặc giao lại.
- Người nhận xem lời mời trong tab **Được giao**, rồi chấp nhận hoặc từ chối.
- Chấp nhận bài sẽ tạo một sơ đồ trắng gắn với bài tập. Người làm có thể tiếp tục sửa sau khi nộp và gửi lại nhiều lần.
- Mỗi lần nộp lưu một phiên bản riêng. Người giao xem nội dung bài nộp, chấm từ 0 đến 10 và gửi nhận xét.
- Tab **Đã giao** giúp người giao theo dõi phản hồi, bài nộp và kết quả.

Supabase có bảng riêng `users`, `diagrams`, `tasks`, tương ứng 1:1 với các collection MongoDB cùng tên. Các trường MongoDB được giữ nguyên tên và có cột riêng; `_id` vẫn là ObjectId dạng chuỗi hex. Cột `document` JSONB chứa nguyên document, gồm `_id` và toàn bộ trường lồng nhau. Khi đọc vào ứng dụng, ObjectId và ngày tháng được khôi phục về kiểu MongoDB. MongoDB dùng `app_sync_outbox` để lưu thao tác chờ đồng bộ khi Supabase lỗi. Đừng đưa thông tin kết nối thật vào Git.
