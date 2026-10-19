# Đăng nhập Google + tự tạo hồ sơ đoàn viên

## Luồng hoạt động

```
Bấm "Đăng nhập bằng Google"
      │
      ▼
Supabase Auth xác thực với Google  →  tạo auth.users
      │
      ▼
AuthGate gọi my_profile_state()
      │
      ├── đã có member_id  ──►  vào ứng dụng (vai trò thật từ profiles)
      │
      └── chưa có hồ sơ    ──►  SignupPage
                                  │
                                  ├─ Bước 1: Họ tên, ngày sinh, giới tính, chi đoàn, SĐT, ngày vào Đoàn
                                  ├─ Bước 2: Học vấn, chuyên môn, nghề nghiệp, lý luận chính trị
                                  ├─ Bước 3: Tôn giáo, dân tộc, Đảng viên, ảnh đại diện
                                  └─ Bước 4: XEM LẠI — đếm ngược 3 giây rồi mới bật "Xác nhận thông tin"
                                             │
                                             ▼
                                     self_register_member()
                                     tạo members + profiles (role = member)
```

Vai trò **luôn là `member`**, không lấy từ client. Cán bộ Đoàn xã nâng quyền sau ở trang Tài khoản & quyền.

## Cấu hình bắt buộc trên Supabase

### 1. Chạy migration

```sql
-- Trong Supabase → SQL Editor, chạy toàn bộ:
supabase/migrations/phase4_google_signup.sql
```

Tạo ra:
- `self_register_member(jsonb)` — tạo hồ sơ + profile
- `signup_options()` — danh sách chi đoàn/dân tộc cho form
- `my_profile_state()` — AuthGate biết tài khoản đã có hồ sơ chưa

### 2. Bật Google provider

1. Google Cloud Console → **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase → **Authentication → Providers → Google** → bật, dán **Client ID** và **Client Secret**.
3. Supabase → **Authentication → URL Configuration**:
   - **Site URL**: địa chỉ app của bạn (ví dụ `http://localhost:3000` khi dev)
   - **Redirect URLs**: thêm đúng địa chỉ app, ví dụ:
     - `http://localhost:3000`
     - `https://ten-mien-that-cua-ban.vn`

> App dùng HashRouter nên `redirectTo` là `origin + pathname` (không có phần sau `#`).
> Nếu Redirect URL không khớp, Google đăng nhập xong sẽ quay về trang trắng hoặc báo `redirect_uri_mismatch`.

### 3. Kiểm tra

```sql
select public.signup_options();        -- phải trả danh sách chi đoàn
select public.my_profile_state();      -- chạy khi đã đăng nhập: phải trả has_profile
```

## Những gì đã thay đổi trong code

| File | Thay đổi |
|---|---|
| `src/pages/LoginPage.tsx` | Nút **Đăng nhập bằng Google** phía trên form email/mật khẩu |
| `src/components/auth/AuthGate.tsx` | Sau đăng nhập, gọi `my_profile_state()`; chưa có hồ sơ → hiện `SignupPage` |
| `src/pages/SignupPage.tsx` | Form 4 bước, xem lại + đếm ngược 3 giây |
| `src/data/repository.ts` | `getSignupOptions()`, `selfRegisterMember()` |
| `src/data/supabaseRepository.ts` | Gọi 2 RPC tương ứng |
| `src/context/AppContext.tsx` | Bọc 2 hàm trên; **đổi `currentRole` mặc định từ `super_admin` → `member`** |

## Về lỗi `currentRole` mặc định

Trước đây `currentRole` khởi tạo là `'super_admin'`. Nghĩa là trong khoảng thời gian đầu (trước khi `refreshData` đọc xong profile), **đoàn viên thấy tạm giao diện quản trị**. Đã đổi mặc định sang `'member'` — quyền thấp nhất. Đây là lỗi bảo mật giao diện, không phải chỉ là hiển thị.

## Giới hạn đã biết

- **Không chống trùng hồ sơ.** Người dùng Google có thể tạo hồ sơ mới dù hồ sơ của họ đã được cán bộ nhập tay trước đó. Cần admin đối chiếu và xóa hồ sơ thừa. Nếu muốn chặn, có thể thêm kiểm tra trùng theo `central_member_code` hoặc họ tên + ngày sinh.
- **Không có bước admin duyệt** (theo lựa chọn "Dùng ngay"). Ai có tài khoản Google cũng tạo được hồ sơ và đọc dữ liệu ở mức quyền `member`.
- **Email Google không được lưu vào `members`** — email nằm ở `auth.users`, đọc qua RPC `member_emails` (chỉ admin).
- Người dùng đổi ý giữa chừng có thể bấm **Đăng xuất** ở bước 1; các bước sau quay lại được bằng **Quay lại**.
