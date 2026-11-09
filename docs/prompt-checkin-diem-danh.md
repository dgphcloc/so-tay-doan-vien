# PROMPT TRIỂN KHAI: KIỂM TRA VỊ TRÍ KHI NỘP MINH CHỨNG NHIỆM VỤ ("CHECK-IN")

> Prompt này đã được viết lại cho khớp **đúng** kiến trúc dự án `so_tay`.
> Bản gốc do AI khác viết giả định Next.js + bảng `events` — cả hai đều không tồn tại
> trong dự án này. Đọc kỹ phần "Hiện trạng dự án" trước khi viết bất cứ dòng code nào.

---

## 0. HIỆN TRẠNG DỰ ÁN (bắt buộc đọc)

### Stack thật
- **React 19 + Vite 8 + TypeScript + Tailwind 4** (KHÔNG phải Next.js)
- Backend: **Supabase** (Postgres + RLS + Auth + Storage + Edge Functions/Deno)
- Điều hướng: `HashRouter`, route khai báo trong `src/App.tsx`
- Tầng dữ liệu: `src/data/` — `Repository` interface, `mockRepository`, `supabaseRepository`,
  và một **Proxy** ở `src/data/index.ts` định tuyến từng method
- State: `src/context/AppContext.tsx` — một `refreshData()` kéo toàn bộ snapshot rồi tính client-side

### Quy ước bắt buộc
- **Không có khái niệm "event/sự kiện".** Hoạt động = `tasks`. Không tạo bảng `events`.
- Mọi migration đặt tên `supabase/migrations/phaseN_mo_ta.sql`, viết idempotent
  (`create table if not exists`, `drop policy if exists ... ; create policy ...`,
  `alter table ... add column if not exists`). Người dùng chạy tay trên Supabase SQL Editor.
- RLS helper có sẵn trong schema `private`, **dùng lại, không tạo mới**:
  `private.my_role()`, `private.my_member_id()`, `private.my_unit_id()`,
  `private.is_admin()`, `private.is_unit_secretary()`
- 5 role: `super_admin`, `admin`, `staff`, `unit_secretary`, `member`
- Mọi nút phải có `title="..."` giải thích chức năng (quy ước toàn dự án)
- **Cấm dùng modal của trình duyệt** (`alert`, `confirm`, `prompt`, `window.confirm`).
  Dùng `useConfirm()` từ `src/components/common/ConfirmDialog.tsx`
- Type DB khai báo ở `src/data/types.ts` với tiền tố `Db*` (vd `DbTask`, `DbMemberSubmission`)
- Bảng map sang TS trong `supabaseRepository.ts` bằng các hàm `toXxx()` (vd `toTask`, `toMemberSubmission`)

### Bảng liên quan đã có
| Bảng | Cột quan trọng |
|---|---|
| `tasks` | `id, title, content, due_date, status, lat, lng, submit_scope, max_score, source_sub_criterion_id, assigned_by, created_at` |
| `task_units` | `task_id, unit_id` |
| `member_submissions` | `id, task_id, member_id, unit_id, note, lat, lng, status('pending'/'approved'/'rejected'), submitted_at, reviewed_by, reviewed_at, review_note` — UNIQUE(`task_id`,`member_id`) |
| `evidences` | `id, task_id, submission_id, member_submission_id, member_id, unit_id, evidence_type, storage_path, url, file_name, captured_at, uploaded_at, lat, lng, source, file_hash, is_locked` |
| `yearly_settings` | `year, criteria_set_id, matured_age, new_member_target, max_photos, max_files, max_links, require_gps` |

### Luồng nộp hiện tại (đã chạy)
1. `MemberSubmitPage.tsx` — đoàn viên chọn nhiệm vụ, thêm ảnh (camera/thư viện), mỗi ảnh
   lấy GPS qua `getGpsPosition()` trong `src/utils/evidence.ts` (trả `{lat, lng, accuracy}`)
2. Có ô nhập tay vĩ độ/kinh độ + ô dán link Google Maps (dùng khi trình duyệt chặn định vị)
3. `submitMemberResult()` trong `supabaseRepository.ts` ghi `member_submissions` + `evidences`
4. `MemberSubmissionsPanel.tsx` — bí thư chi đoàn/admin duyệt, xem ảnh + toạ độ từng ảnh

---

## 1. MỤC TIÊU

Bổ sung **kiểm tra vị trí** ("check-in") vào luồng nộp minh chứng **đã có**:
khi đoàn viên nộp bài cho một nhiệm vụ có toạ độ điểm tổ chức, hệ thống tính khoảng cách
từ ảnh minh chứng tới điểm tổ chức và gắn nhãn để cán bộ cân nhắc khi duyệt.

**KHÔNG tạo bảng check-in riêng. KHÔNG tạo trang check-in riêng.**
Check-in là **thuộc tính của lượt nộp**, không phải thực thể độc lập.

---

## 2. QUY TẮC NGHIỆP VỤ (đã chốt với chủ dự án)

### 2.1 Đo khoảng cách
- Trình duyệt chỉ gửi `lat`, `lng`, `accuracy`. **Không tính khoảng cách ở trình duyệt**
  cho kết quả chính thức.
- Khoảng cách **phải tính trong database** bằng hàm Postgres Haversine (đơn vị mét),
  gọi qua **trigger** khi ghi `member_submissions`. Không cho client ghi đè kết quả.
- Thời điểm nộp lấy bằng `now()` của database, không tin giờ client.

### 2.2 Lấy toạ độ nào khi có nhiều ảnh
- Đoàn viên thường nộp nhiều ảnh, **mỗi ảnh có GPS riêng** (`evidences.lat/lng`).
- Quy tắc: **một ảnh nằm trong phạm vi là đạt** (khoảng cách nhỏ nhất tới điểm tổ chức
  được dùng để xét).
- Lưu khoảng cách **nhỏ nhất** đó vào lượt nộp, kèm chỉ số ảnh đã dùng.

### 2.3 Kết quả 4 nhãn
| Nhãn | Điều kiện |
|---|---|
| `in_range` — Trong phạm vi | `distance_m <= radius_m` |
| `out_of_range` — Ngoài phạm vi | `distance_m > radius_m` |
| `no_coords` — Chưa có toạ độ | Nhiệm vụ có toạ độ nhưng **không ảnh nào** có GPS, và `require_gps = false` |
| `low_accuracy` — Độ chính xác kém | Ảnh tốt nhất có `accuracy > max_accuracy_m` |

- `low_accuracy`: **vẫn cho nộp**, tạo lượt `pending` bình thường, chỉ gắn nhãn để cán bộ cân nhắc.
- Hệ thống **không tự từ chối** khi ngoài phạm vi — chỉ gắn nhãn, cán bộ quyết định.

### 2.4 Khi nào kiểm tra
- **Chỉ kiểm tra khi nhiệm vụ có toạ độ** (`tasks.lat` và `tasks.lng` khác null).
- Nhiệm vụ không có toạ độ (đa số nhiệm vụ KPI dài ngày): **bỏ qua hoàn toàn**, để trống nhãn.
- Không thêm cờ "bắt buộc định vị" riêng cho nhiệm vụ.

### 2.5 Nguồn toạ độ (chống gõ tay)
- Giữ ô nhập tay và ô dán link Google Maps (đã có), nhưng **lưu lại nguồn**:
  `gps` (từ thiết bị) / `manual` (nhập tay) / `link` (dán link Maps).
- Ảnh/toạ độ nguồn `manual` hoặc `link` vẫn tính bán kính bình thường, **nhưng hiện nhãn
  cảnh báo riêng "Không xác thực"** để cán bộ biết toạ độ không lấy từ thiết bị.
- Nhãn nguồn lưu ở **mức từng ảnh** (`evidences.coord_source`) và mức lượt nộp
  (`member_submissions.coord_source` = nguồn "yếu nhất" trong các ảnh).

### 2.6 Khung giờ điểm danh
- Thêm **giờ mở / giờ đóng điểm danh riêng** cho nhiệm vụ (`tasks.attendance_open_at`,
  `tasks.attendance_close_at`), **hẹp hơn hoặc bằng** `due_date`.
- Để trống = không giới hạn riêng, chỉ dùng `due_date` như hiện tại.
- **Nộp ngoài khung: VẪN CHO NỘP**, nhưng gắn thêm cờ `submitted_outside_window = true`
  để cán bộ thấy nhãn **"Nộp ngoài giờ"** khi duyệt. Không chặn cứng — tránh mất bài
  khi mạng lag hoặc đoàn viên đến muộn vài phút.
- So sánh bằng giờ database (`now()`), không tin giờ client.

### 2.7 Chống trùng
- Đã có `UNIQUE(task_id, member_id)` trên `member_submissions` → giữ nguyên.
- Lượt `approved` không sửa được (đã chặn ở tầng code); lượt `pending`/`rejected` được nộp lại.

### 2.8 Giới hạn dữ liệu (ràng buộc ở DB, không chỉ ở UI)
- Bán kính: **tối thiểu 20 m, tối đa 1.000 m**
- Ngưỡng sai số: **tối thiểu 5 m, tối đa 500 m**
- `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]`

---

## 3. CẤU HÌNH BÁN KÍNH — 2 TẦNG

| Tầng | Nơi lưu | Ai sửa | Mặc định |
|---|---|---|---|
| 1. Toàn hệ thống | `yearly_settings.default_radius_m`, `yearly_settings.max_accuracy_m` | **chỉ `super_admin`, `admin`** | 100 m / 100 m |
| 2. Riêng từng nhiệm vụ | `tasks.radius_m` (nullable) | `admin`, `staff`, **`unit_secretary` (nhiệm vụ do chính họ tạo)** | trống = dùng tầng 1 |

- Tầng cụ thể hơn thắng: `tasks.radius_m ?? yearly_settings.default_radius_m`.
- **Mỗi lượt nộp lưu bán kính đã áp dụng** (`member_submissions.radius_applied_m`) —
  sửa bán kính sau đó **không** làm đổi kết quả các lượt cũ.
- Giữ chỗ để sau này thêm tầng "mặc định theo loại nhiệm vụ" mà không phải đổi cấu trúc
  (đặt tên cột đủ tổng quát, không hard-code logic 2 tầng vào hàm tính).

---

## 4. DỮ LIỆU CẦN THÊM — 1 FILE MIGRATION DUY NHẤT

File: `supabase/migrations/phase14_attendance_checkin.sql`

### 4.1 `yearly_settings`
```
default_radius_m   numeric(6,1) not null default 100  check (>= 20 and <= 1000)
max_accuracy_m     numeric(6,1) not null default 100  check (>= 5  and <= 500)
```

### 4.2 `tasks`
```
radius_m              numeric(6,1)  check (radius_m is null or (radius_m >= 20 and radius_m <= 1000))
attendance_open_at    timestamptz
attendance_close_at   timestamptz
-- ràng buộc: nếu có cả 2 thì open <= close, và close <= due_date
```

### 4.3 `member_submissions`
```
accuracy_m          numeric(6,1)
distance_m          numeric(8,1)          -- khoảng cách nhỏ nhất trong các ảnh
radius_applied_m    numeric(6,1)          -- bán kính dùng lúc tính
checkin_result      text                  -- 'in_range' | 'out_of_range' | 'no_coords' | 'low_accuracy' | null
coord_source        text                  -- 'gps' | 'manual' | 'link' | null
closest_evidence_id bigint references evidences(id) on delete set null
```
Thêm CHECK constraint cho `checkin_result` và `coord_source` (cho phép null).

### 4.4 `evidences`
```
accuracy_m     numeric(6,1)   check (accuracy_m is null or accuracy_m >= 0)
coord_source   text           -- 'gps' | 'manual' | 'link' | null
```

### 4.5 Hàm Haversine
```sql
create or replace function public.haversine_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) returns double precision
language sql immutable parallel safe as $$
  -- 6371000 m bán kính Trái Đất
$$;
```
`revoke all ... from public; grant execute ... to authenticated;`

### 4.6 Trigger tính check-in — chạy khi nào
Trigger trên `member_submissions` **sau INSERT hoặc UPDATE**, tính lại khi `lat/lng` đổi.
Vì `evidences` được insert **sau** `member_submissions` trong `submitMemberResult()`, cần
thêm trigger trên `evidences` (sau INSERT/DELETE) để tính lại lượt nộp cha khi bộ ảnh đổi.

Pseudo-logic trigger (viết bằng plpgsql, `security definer`):
```
1. Đọc task của lượt nộp -> lấy lat/lng/radius_m/attendance_* /due_date
2. Nếu task.lat hoặc task.lng null  -> checkin_result = null, distance_m = null, DONE
3. Kiểm tra khung giờ: nếu có attendance_open_at/close_at và now() ngoài khoảng
   -> submitted_outside_window = true (KHÔNG chặn, vẫn lưu bài)
4. BASIC: lấy ảnh có lat/lng khác null của lượt nộp này,
   tính haversine tới task, chọn ảnh gần nhất -> distance_m, closest_evidence_id, accuracy_m
5. Nếu không ảnh nào có toạ độ:
     a. Nếu member_submissions.lat/lng có giá trị (nhập tay) -> dùng nó, coord_source lấy từ input
     b. Ngược lại -> checkin_result = 'no_coords', DONE
6. radius_applied_m = coalesce(task.radius_m, yearly_settings.default_radius_m của năm của task)
7. So sánh accuracy_m với max_accuracy_m:
     > ngưỡng -> 'low_accuracy'
     ngược lại -> distance_m <= radius_applied_m ? 'in_range' : 'out_of_range'
8. coord_source = 'gps' nếu ảnh dùng có coord_source='gps', ngược lại 'manual'/'link'
9. Ghi lại các cột vào member_submissions
```

### 4.7 RLS
- **Thu hồi** quyền `insert, update` trực tiếp của role `authenticated` trên các cột kết quả
  (`distance_m`, `radius_applied_m`, `checkin_result`, `accuracy_m`, `closest_evidence_id`).
  Cách thực tế với Supabase: dùng **trigger `BEFORE INSERT/UPDATE`** ghi đè các cột này
  bằng giá trị tính lại — client gửi gì cũng bị thay.
- Giữ nguyên policy hiện có của `member_submissions` (member chỉ nộp cho mình, trạng thái
  `pending`; bí thư chi đoàn duyệt đơn vị mình; admin toàn quyền).
- Đảm bảo `unit_secretary` đọc được `evidences` của đơn vị mình (kiểm tra policy hiện có,
  bổ sung nếu thiếu).

---

## 5. GIAO DIỆN

### 5.1 Form tạo/sửa nhiệm vụ — áp dụng cho CẢ `TasksPage.tsx` lẫn `CreateTaskDropdown.tsx`
(bí thư chi đoàn tạo nhiệm vụ từ tiêu chí KPI cũng nhập được toạ độ + bán kính như admin)
Thêm nhóm **"Định vị điểm danh"**:
- Nút **"Lấy vị trí hiện tại"** (cán bộ đứng tại chỗ bấm) → gọi `getGpsPosition()`, điền lat/lng
- Ô dán link Google Maps → tái dùng `parseMapLink()` đã có trong `MemberSubmitPage.tsx`
  (tách hàm này ra `src/utils/geo.ts` để dùng chung, không copy-paste)
- Ô nhập tay vĩ độ / kinh độ
- Ô **bán kính (m)**: để trống = dùng mặc định, hiện placeholder
  `"Mặc định: 100 m"` (đọc từ `yearlySettings`)
- Ô **giờ mở / giờ đóng điểm danh** (`datetime-local`), để trống = không giới hạn
- Nếu đã nhập toạ độ: hiện link "Xem trên Google Maps"

### 5.2 Cấu hình năm (`src/pages/SettingsPage.tsx`)
Thêm 2 ô trong tab cấu hình chung:
- Bán kính mặc định (m) — 20..1000
- Ngưỡng sai số GPS tối đa (m) — 5..500
Chỉ `super_admin`/`admin` sửa được; vai trò khác thấy disabled kèm tooltip lý do.

### 5.3 Trang nộp cá nhân (`src/pages/MemberSubmitPage.tsx`)
Khi nhiệm vụ có toạ độ:
- Khối thông tin: **"Bạn cần ở trong bán kính X m quanh điểm tổ chức"**
  (X = `tasks.radius_m ?? yearlySettings.default_radius_m`)
- Gợi ý: *"Nên dùng điện thoại và bật định vị để có toạ độ chính xác."*
- **Nhắc trước khi nộp (tính nháp ở máy)**: nếu mọi ảnh đã có GPS, tự tính Haversine phía
  client (hàm riêng trong `src/utils/geo.ts`) và hiện cảnh báo mềm:
  *"Có vẻ bạn đang ngoài phạm vi (ước tính ~350 m). Kết quả chính thức do hệ thống tính khi bạn nộp."*
  → **Kết quả nháp này KHÔNG được gửi lên server.**
- Ảnh nhập toạ độ tay/dán link: hiện icon cảnh báo nhỏ **"Không xác thực"**
- Nếu độ chính xác kém: hiện cảnh báo *"Toạ độ chưa chính xác (sai số ~X m). Bài vẫn nộp được
  nhưng cán bộ sẽ thấy nhãn 'Độ chính xác kém'."*
- Ngoài khung giờ điểm danh: hiện nhắc *"Điểm danh mở từ A đến B — bài nộp của bạn sẽ được
  gắn nhãn 'Ngoài giờ'."* (vẫn cho nộp)
- **Sau khi nộp thành công: giữ nguyên thông báo như hiện tại** (*"Đã gửi bài nộp, chờ bí thư
  chi đoàn xác nhận"*). KHÔNG hiện kết quả check-in cho đoàn viên xem ngay.
  Kết quả chỉ hiện khi họ mở lại bài đã nộp và ở màn hình duyệt của cán bộ.

### 5.4 Màn hình duyệt (`src/components/review/MemberSubmissionsPanel.tsx`)
- Mỗi bài nộp hiện khối check-in:
  - Nhãn màu: 🟢 Trong phạm vi (X m) · 🔴 Ngoài phạm vi (X m / bán kính Y m) ·
    ⚪ Chưa có toạ độ · 🟠 Độ chính xác kém (±X m) · ⚫ Không xác thực (nhập tay)
  - Nhãn phụ **"Nộp ngoài giờ"** khi `submitted_outside_window = true`
  - Link "Xem trên Google Maps" tới toạ độ ảnh gần nhất
- **Bộ lọc theo nhãn**: 6 chip `Tất cả / Trong phạm vi / Ngoài phạm vi / Chưa có toạ độ /
  Độ chính xác kém / Ngoài giờ` — hoạt động cùng bộ lọc trạng thái hiện có
- Bài nộp của nhiệm vụ không có toạ độ: không hiện khối check-in

---

## 6. TRƯỜNG HỢP BIÊN BẮT BUỘC XỬ LÝ

| Ca | Hành vi mong đợi |
|---|---|
| Từ chối quyền vị trí | Toast tiếng Việt rõ ràng + gợi ý nhập tay/dán link. Không crash. |
| Trình duyệt không hỗ trợ Geolocation | Như trên |
| Trang chạy HTTP (không HTTPS) | Geolocation API không chạy — phát hiện `!window.isSecureContext` và báo trước |
| Nhiệm vụ có toạ độ, không ảnh nào có GPS, `require_gps=true` | Chặn nộp, báo phải bật định vị |
| Nhiệm vụ có toạ độ, không ảnh nào có GPS, `require_gps=false` | Cho nộp, nhãn `no_coords` |
| Nhiệm vụ có toạ độ nhưng `lat/lng` chỉ có 1 trong 2 | Coi như **không có toạ độ**; chặn lưu nhiệm vụ ở UI với message rõ |
| Bài nộp có từ trước migration | Để trống nhãn, KHÔNG backfill, không hiện khối check-in |
| Ngoài khung giờ điểm danh | Vẫn cho nộp, gắn `submitted_outside_window = true`, hiện nhãn "Nộp ngoài giờ" |
| Toạ độ ngoài miền hợp lệ | DB từ chối qua CHECK constraint |
| Bán kính ngoài 20..1000 | DB từ chối; UI báo trước khi lưu |
| Nộp lại sau khi bị từ chối | Tính lại check-in với bộ ảnh mới |
| Xoá hết ảnh rồi nộp lại | Tính lại → có thể thành `no_coords` |
| Nhiều ảnh, 1 ảnh trong phạm vi | `in_range` (lấy khoảng cách nhỏ nhất) |

---

## 7. THỨ TỰ THI CÔNG (dừng báo cáo sau MỖI bước)

### Bước 1 — Migration + RLS + hàm Haversine + trigger
Giao **một file SQL duy nhất** `phase14_attendance_checkin.sql`, chạy được ngay trên
Supabase SQL Editor, **không lỗi** (ràng buộc idempotent, guard `to_regclass` khi cần).
Kèm câu `select` kiểm tra cuối file.

### Bước 2 — Tầng dữ liệu TS
- Cập nhật `src/data/types.ts`: thêm cột vào `DbTask`, `DbMemberSubmission`, `DbEvidence`,
  `DbYearlySettings`
- Cập nhật các hàm `toTask` / `toMemberSubmission` / `toEvidence` / `toYearlySettings`
  trong `supabaseRepository.ts`
- Cập nhật `submitMemberResult()` để gửi kèm `coord_source`, `accuracy_m` cho từng ảnh
- Cập nhật `mockRepository.ts` + `src/mock/data.ts` cho khớp (mock phải build được)

### Bước 3 — Giao diện cấu hình
- Form nhiệm vụ: khối "Định vị điểm danh"
- Trang Cấu hình năm: 2 ô bán kính / ngưỡng sai số
- Tách `parseMapLink()` + thêm `haversineMeters()` vào `src/utils/geo.ts` dùng chung

### Bước 4 — Giao diện nộp + duyệt
- `MemberSubmitPage`: khối thông tin bán kính, nhắc nháp, nhãn "Không xác thực",
  xử lý lỗi khung giờ
- `MemberSubmissionsPanel`: khối check-in + bộ lọc 5 chip

### Cuối mỗi bước, báo bằng tiếng Việt, ngắn gọn
1. Đã thay đổi file nào, làm gì
2. File SQL nào cần chạy (nếu có)
3. Cách thử trên giao diện
4. Các ca kiểm thử mẫu đã chuẩn bị (gần / xa / sát biên / sai số kém / ngoài giờ / chưa có toạ độ)

---

## 8. NGUYÊN TẮC LÀM VIỆC

- **Không đập lại phần đã chạy.** Đọc code hiện có trước khi sửa.
- **Không tạo bảng/thực thể mới** cho check-in — chỉ thêm cột.
- **Không copy-paste** hàm đã có (`parseMapLink`, `getGpsPosition`) — tách ra dùng chung.
- **Không dùng modal trình duyệt.** Dùng `useConfirm()`.
- **Mọi nút phải có `title`** giải thích chức năng.
- **Điểm nào mơ hồ → HỎI trước, không tự đoán.**
- Sau khi sửa: chạy `npx tsc --noEmit` và `npm run build` phải sạch trước khi báo cáo.