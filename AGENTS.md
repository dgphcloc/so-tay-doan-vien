# AGENTS.md — TÀI LIỆU HƯỚNG DẪN DÀNH CHO AGENT & DEVELOPER

> Tài liệu này được tổng hợp tự động từ việc quét toàn diện cấu trúc mã nguồn, cấu hình, dữ liệu và tài liệu kỹ thuật hiện có của dự án. Không chỉnh sửa bất kỳ file nguồn nào trong quá trình khảo sát.

---

## 1. DỰ ÁN LÀM GÌ (Project Overview)

- **Tên dự án:** Sổ tay Đoàn viên – Quản trị (tên định danh: `react-example` / `Sổ tay Đoàn viên – Quản trị`).
- **Mục tiêu:** Hệ thống thông tin quản trị số hoá toàn diện công tác Đoàn Thanh niên Cộng sản Hồ Chí Minh cấp xã/phường/thị trấn, tích hợp Sổ tay Đoàn viên điện tử và công cụ theo dõi, đánh giá tiến độ thực hiện nhiệm vụ (đã bỏ hẳn việc tính điểm thi đua).
- **Đối tượng sử dụng (5 vai trò chuẩn):**
  1. `super_admin` (Quản trị viên tối cao): Quản trị kỹ thuật, phân quyền tài khoản, xem toàn bộ nhật ký hệ thống (`audit_logs`).
  2. `admin` (Quản trị viên Đoàn xã): Bí thư / Phó Bí thư Đoàn xã, điều hành nhiệm vụ, bộ tiêu chí, duyệt bài nộp của chi đoàn, quản lý tổ chức.
  3. `staff` (Cán bộ Đoàn xã): Chuyên viên, cán bộ hỗ trợ công tác Đoàn (chế độ chỉ xem đối với hầu hết các phân hệ).
  4. `unit_secretary` (Bí thư / Phó Bí thư Chi đoàn): Quản lý đoàn viên trong chi đoàn, duyệt minh chứng cá nhân của đoàn viên, nộp báo cáo tổng hợp cấp chi đoàn, nộp minh chứng tiêu chí thi đua.
  5. `member` (Đoàn viên): Xem bảng tin hoạt động, đăng ký tham gia, quét QR check-in, nộp minh chứng thực địa (ảnh + GPS), ghi chép sổ tay cá nhân, nộp đoàn phí qua VietQR.

### Các phân hệ & luồng nghiệp vụ cốt lõi

1. **Quản lý Tổ chức & Nhân sự:**
   - Quản lý danh mục Chi đoàn (`units`): Dân cư, Trường học, Y tế, Công an, Khác (`unit_types`).
   - Quản lý Đoàn viên (`members`): Hồ sơ cá nhân, ngày kết nạp, trình độ học vấn, lý luận chính trị, chức vụ, tình trạng Đảng viên, đoàn viên ưu tú.
   - Quản lý Ban Chấp hành (`unit_committees`): Nhiệm kỳ, chức danh, tự động đồng bộ vai trò hệ thống khi phân công.
2. **Quản lý Nhiệm vụ (Tasks):**
   - Vòng đời: `draft` (nháp) $\rightarrow$ `published` (đã phát động) $\rightarrow$ `closed` (đóng/hoàn tất).
   - Phạm vi nộp (`submit_scope`): Giao cụ thể cho các chi đoàn (`assigned` qua `task_units`) hoặc mở tự do toàn xã (`open`).
   - Gắn vị trí thực địa (tọa độ GPS `lat`, `lng` trung tâm sự kiện) và liên kết tiêu chí thi đua (`task_sub_criteria`).
3. **Quy trình Nộp minh chứng & Duyệt 2 cấp (Two-Tier Review):**
   - **Cấp 1 (Đoàn viên $\rightarrow$ Bí thư Chi đoàn):** Đoàn viên tham gia sự kiện nộp minh chứng cá nhân (`member_submissions`) gồm hình ảnh chụp tại chỗ (camera/upload), tọa độ GPS, ghi chú. Bí thư chi đoàn duyệt bài hoặc từ chối yêu cầu nộp lại.
   - **Cấp 2 (Bí thư Chi đoàn $\rightarrow$ Đoàn xã):** Bí thư chi đoàn nộp báo cáo tổng hợp cấp chi đoàn (`task_results`) và bài nộp tiêu chí (`criterion_submissions`). Thường trực Đoàn xã duyệt kết quả để chốt hoàn thành.
4. **Bộ Tiêu chí thi đua (Criteria & KPI Tree):**
   - Cấu trúc 4 cấp: Bộ tiêu chí năm (`criteria_sets`) $\rightarrow$ Phần (`criteria_sections`) $\rightarrow$ Tiêu chí (`criteria`) $\rightarrow$ Tiêu chí con (`sub_criteria`).
   - Hỗ trợ nhân bản bộ tiêu chí sang năm mới, khóa/lưu trữ (`archived_at`), và theo dõi tiến độ hoàn thành tiêu chí (đã bỏ hẳn việc tính điểm số).
5. **Tự phục vụ & Xác thực Google:**
   - Đoàn viên đăng nhập qua Google OAuth (Supabase Auth). Nếu chưa có hồ sơ, chuyển hướng đến `SignupPage` để tự khai báo 4 bước (có đếm ngược 3 giây xác nhận).
   - Tài khoản tự đăng ký có trạng thái chờ duyệt (`approval_status: pending`) trước khi được kích hoạt chính thức.
6. **Sổ tay Đoàn viên điện tử (Journal):**
   - Không gian nhật ký cá nhân riêng tư tuyệt đối của đoàn viên, hỗ trợ đính kèm hình ảnh và liên kết.
7. **Đoàn phí (Union Fee) & Tích hợp VietQR / payOS:**
   - Quản lý mức thu đoàn phí theo quy định (Hướng dẫn 39, phân loại đoàn viên có lương / không lương, tháng miễn giảm).
   - Tự động sinh mã VietQR Napas 247 đúng chuẩn cú pháp ngân hàng.
   - Tích hợp cổng thanh toán payOS (Edge Functions + Webhook) để tự động gạch nợ real-time khi đoàn viên chuyển khoản.
8. **Đánh giá & Xếp loại hàng năm (Evaluation):**
   - Đánh giá xếp loại chất lượng đoàn viên và tổ chức cơ sở Đoàn theo các đợt/kỳ đánh giá (`evaluation_periods`), chương trình Rèn luyện đoàn viên (RLDV), ghi nhận khen thưởng/kỷ luật.
9. **Báo cáo & Nhật ký:**
   - Thống kê Dashboard KPI, xuất dữ liệu biểu mẫu Excel (danh sách đoàn viên, BCH, tiêu chí, đoàn phí, tài khoản) và PDF. Lưu trữ snapshot báo cáo tĩnh (`reports.data`).
   - Nhật ký hoạt động (`audit_logs`) ghi nhận mọi thao tác quản trị.

---

## 2. CÔNG NGHỆ SỬ DỤNG (Tech Stack & Architecture)

| Thành phần | Công nghệ / Thư viện | Phiên bản | Ghi chú |
|---|---|---|---|
| **Frontend Core** | React | `^19.0.1` | React 19 mới nhất, dùng functional components + hooks |
| **Build Tool & Dev Server** | Vite | `^8.3.0` | Cấu hình cổng 3000, host `0.0.0.0` |
| **Ngôn ngữ** | TypeScript | `^7.0.2` | Target `ES2022`, module `ESNext`, strict mode, bundler resolution |
| **Định tuyến (Routing)** | React Router DOM | `^7.18.4` | **Sử dụng `HashRouter`** (phù hợp hosting tĩnh, không bị lỗi 404 khi F5) |
| **Styling / CSS** | Tailwind CSS | `^4.3.3` | Tailwind v4 dùng `@tailwindcss/vite`, font `Be Vietnam Pro` |
| **Icon set** | Lucide React | `^0.546.0` | Bộ icon chính thống của toàn bộ giao diện |
| **Biểu đồ & Hoạt họa** | Recharts & Motion | `recharts: ^3.10.1`, `motion: ^12.23.24` | Thống kê Dashboard, biểu đồ cột thi đua |
| **Backend & BaaS** | Supabase | `@supabase/supabase-js: ^2.117.3` | PostgreSQL, Auth, Storage, Edge Functions, RLS |
| **Xử lý Excel** | ExcelJS | `^4.4.0` | Xuất/nhập file Excel danh sách, biểu mẫu |
| **QR Code** | `qrcode` & `jsqr` | `qrcode: ^1.5.4`, `jsqr: ^1.4.0` | Tạo mã QR sự kiện và quét QR điểm danh bằng webcam |
| **Cổng thanh toán** | payOS & VietQR | Tích hợp tùy biến | Tạo mã QR Napas 247 và webhook xử lý gạch nợ tự động |
| **Runtime Backend** | Deno (Supabase Functions) | Standard Deno | Edge Functions phục vụ webhook và tạo tài khoản bảo mật |

### Kiến trúc Tầng Dữ liệu (Dual Data Source Pattern)
- **Repository Pattern:** Toàn bộ ứng dụng giao tiếp dữ liệu qua interface chuẩn `Repository` (`src/data/repository.ts`).
- **Nguồn kép (Dual Mode):**
  - **`mock`:** Lưu trữ in-memory dựa trên `src/mock/data.ts` và `src/mock/seed.json`, chạy ngay lập tức không cần mạng hay Supabase.
  - **`supabase`:** Đọc/ghi cơ sở dữ liệu Supabase PostgreSQL thật thông qua `SupabaseGd1Repository`.
- **Cơ chế Proxy (`src/data/index.ts`):** Sử dụng JavaScript `Proxy` để định tuyến từng method và nạp `hybridSnapshot()` phục vụ `AppContext`.

### Phụ thuộc đặc thù & Cần xác nhận
- `@google/genai` (`^2.4.0`): Có khai báo trong `package.json` và `README.md` (xuất phát từ template Google AI Studio), nhưng hiện tại **không có bất kỳ file nào trong `src/` import hay sử dụng**. `[CẦN XÁC NHẬN]`
- `express` (`^4.21.2`), `pg` (`^8.23.1`), `dotenv` (`^17.2.3`): Có trong dependencies và lệnh `clean` có `rm -rf server.js`, nhưng hiện không có file `server.js` hoặc server backend Express trong dự án. `[CẦN XÁC NHẬN]`

---

## 3. CẤU TRÚC THƯ MỤC (Folder Structure)

```
so_tay/
├── .claude/                     # Cấu hình IDE Claude (launch.json)
├── docs/                        # Tài liệu phân tích nghiệp vụ & hướng dẫn kiểm thử
│   ├── dang-nhap-google.md      # Hướng dẫn cấu hình Google OAuth + tự tạo hồ sơ
│   ├── huong-dan-payos.md       # Hướng dẫn kết nối cổng payOS và Supabase Secrets
│   ├── kiem-thu-giai-doan-3.md  # Kịch bản 48 test case kiểm thử thủ công
│   ├── phan-tich-luong-nghiep-vu.md # Đối chiếu nghiệp vụ, code, RLS và các điểm lệch
│   └── prompt-checkin-diem-danh.md  # Đặc tả kỹ thuật GPS check-in và kiến trúc dự án
├── scripts/                     # Script Node.js phục vụ quản trị dữ liệu bằng Service Role
│   ├── create-accounts.mjs      # Tạo tài khoản đăng nhập Supabase Auth hàng loạt
│   └── seed-members.mjs         # Tạo dữ liệu đoàn viên mẫu (chứa cờ note 'SEED')
├── src/                         # Mã nguồn chính của ứng dụng
│   ├── components/              # Các UI Components tái sử dụng
│   │   ├── auth/                # Cổng kiểm soát truy cập (AuthGate, RequireRole)
│   │   ├── common/              # Dialog, Toast, Avatar, Badge, EmptyState, Loading...
│   │   ├── criteria/            # Modal import tiêu chí, bảng KPI, panel tiêu chí
│   │   ├── layout/              # AppLayout, Navbar, Sidebar, BottomNav
│   │   ├── review/              # Duyệt minh chứng cá nhân và chi đoàn
│   │   └── tasks/               # Tạo nhiệm vụ, quét QR, gắn tiêu chí, báo cáo
│   ├── context/                 # Quản lý State toàn cục
│   │   └── AppContext.tsx       # Context chính, nạp snapshot dữ liệu, tính KPI, toast
│   ├── data/                    # Tầng dữ liệu (Repository Pattern)
│   │   ├── index.ts             # Điểm ghép nối (Proxy giữa Mock và Supabase)
│   │   ├── repository.ts        # Định nghĩa interface Repository & EvidenceInput
│   │   ├── mockRepository.ts    # Triển khai in-memory Mock
│   │   ├── supabaseClient.ts    # Khởi tạo Supabase Client từ biến môi trường
│   │   ├── supabaseRepository.ts# Triển khai thao tác Supabase DB, mapper toXxx()
│   │   ├── types.ts             # Kiểu dữ liệu database (Db*), enums, filter, stats
│   │   ├── snapshotError.ts     # Bắt và lắng nghe lỗi snapshot dữ liệu
│   │   └── useRepo.ts           # React hook bọc repository
│   ├── mock/                    # Dữ liệu tĩnh mẫu và các helper ngày giờ
│   │   ├── data.ts              # Dữ liệu mock mảng, format ngày tháng VN
│   │   └── seed.json            # Dữ liệu seed JSON gốc
│   ├── pages/                   # 23 trang màn hình của ứng dụng
│   │   ├── AccountsPage.tsx     # Quản lý tài khoản & phân quyền (/tai-khoan)
│   │   ├── AuditLogsPage.tsx    # Nhật ký hệ thống (/nhat-ky)
│   │   ├── CommitteePage.tsx    # Quản lý Ban Chấp hành (/ban-chap-hanh, /bch)
│   │   ├── CriteriaPage.tsx     # Cây tiêu chí thi đua (/tieu-chi)
│   │   ├── DashboardPage.tsx    # Bảng tổng quan Dashboard (/)
│   │   ├── EvaluationPage.tsx   # Đánh giá xếp loại & RLDV (/danh-gia)
│   │   ├── FeedPage.tsx         # Bảng tin hoạt động cho đoàn viên (/bang-tin)
│   │   ├── JournalPage.tsx      # Sổ tay cá nhân riêng tư (/so-tay)
│   │   ├── LoginPage.tsx        # Màn hình đăng nhập (chế độ Supabase)
│   │   ├── MembersPage.tsx      # Quản lý danh sách đoàn viên (/doan-vien)
│   │   ├── MemberSubmitPage.tsx # Đoàn viên nộp minh chứng cá nhân (/nop-ca-nhan)
│   │   ├── MyProfilePage.tsx    # Xem & sửa hồ sơ cá nhân (/ho-so)
│   │   ├── RemindersPage.tsx    # Cảnh báo & nhắc nhở việc quá hạn (/nhac-nho)
│   │   ├── ReportsPage.tsx      # Quản lý & xuất báo cáo (/bao-cao)
│   │   ├── ReviewPage.tsx       # Duyệt minh chứng cá nhân & chi đoàn (/duyet)
│   │   ├── SettingsPage.tsx     # Cấu hình năm, tuổi, danh mục (/cau-hinh)
│   │   ├── SetupWizardPage.tsx  # Trình hướng dẫn thiết lập đầu năm (/thiet-lap)
│   │   ├── SignupPage.tsx       # Tự hoàn thiện hồ sơ sau đăng nhập Google
│   │   ├── SubmitPage.tsx       # Chi đoàn nộp báo cáo tổng hợp (/nop-minh-chung)
│   │   ├── TasksPage.tsx        # Quản trị nhiệm vụ (/nhiem-vu)
│   │   ├── UnionFeePage.tsx     # Thu nộp & gạch nợ đoàn phí (/doan-phi)
│   │   ├── UnitReportPage.tsx   # Báo cáo hoạt động chi đoàn (/bao-cao-chi-doan)
│   │   └── UnitsPage.tsx        # Danh mục Chi đoàn (/chi-doan)
│   ├── types/                   # Định nghĩa kiểu dữ liệu domain & UI (index.ts)
│   ├── utils/                   # Các hàm tiện ích thuần (pure utilities)
│   │   ├── accountsExcel.ts     # Xuất/nhập Excel tài khoản
│   │   ├── committeeExcel.ts    # Xuất/nhập Excel Ban Chấp hành
│   │   ├── criteriaAssignment.ts# Gán tiêu chí cho nhiệm vụ
│   │   ├── criteriaImport.ts    # Nhập bộ tiêu chí từ Excel
│   │   ├── evaluationRules.ts   # Quy tắc xếp loại thi đua
│   │   ├── evidence.ts          # Xử lý định vị GPS, camera, hash file minh chứng
│   │   ├── exportExcel.ts       # Xuất Excel tổng hợp
│   │   ├── exportPdf.ts         # Xuất PDF
│   │   ├── geo.ts               # Xử lý tọa độ, khoảng cách, bóc tách link Google Maps
│   │   ├── kpiTree.ts           # Xử lý cấu trúc cây tiêu chí KPI
│   │   ├── membersImport.ts     # Nhập đoàn viên từ Excel
│   │   ├── memberTemplate.ts    # Mẫu Excel danh sách đoàn viên
│   │   ├── permissions.ts       # Quy tắc phân quyền, kiểm tra quyền truy cập route
│   │   ├── settingsCatalogExcel.ts # Xuất/nhập danh mục cấu hình
│   │   ├── unionFeeExcel.ts     # Xuất/nhập danh sách đoàn phí
│   │   ├── unitsExcel.ts        # Xuất/nhập danh sách chi đoàn
│   │   ├── vietnamese.ts        # Tiện ích xử lý chuỗi tiếng Việt không dấu
│   │   └── vietQr.ts            # Xử lý tạo chuỗi chuyển khoản & mã VietQR Napas 247
│   ├── App.tsx                  # Root component, router config, provider wrapper
│   ├── index.css                # Tailwind CSS v4 entry & theme config
│   ├── main.tsx                 # Entrypoint React 19
│   └── vite-env.d.ts            # Vite client types
├── supabase/                    # Quản trị Supabase Backend
│   ├── functions/               # Supabase Edge Functions (Deno)
│   │   ├── admin-create-member-account/ # API tạo tài khoản đoàn viên bằng Service Role
│   │   ├── payos-create-payment/        # API tạo link thanh toán payOS
│   │   └── payos-webhook/               # Webhook nhận thông báo tiền về từ payOS
│   └── migrations/              # 24 migration SQL theo phase (chạy idempotent)
├── .env.example                 # Mẫu cấu hình biến môi trường
├── .env.local                   # Cấu hình môi trường nội bộ (không commit)
├── .gitignore                   # Cấu hình bỏ qua tệp Git
├── bun.lock                     # Lockfile cho Bun package manager
├── DATA_CONTRACT.md             # Hợp đồng dữ liệu chi tiết giữa UI và Database
├── metadata.json                # Thông tin mô tả app từ Google AI Studio
├── package.json                 # Khai báo dependency và scripts
├── README.md                    # Tài liệu giới thiệu nhanh dự án
├── tsconfig.json                # Cấu hình TypeScript compiler
└── vite.config.ts               # Cấu hình Vite bundler & Tailwind plugin
```

---

## 4. LỆNH CHẠY / BUILD / TEST (Commands)

### Lệnh chạy môi trường phát triển (Development)
```bash
# Cài đặt thư viện dependencies
npm install
# (hoặc dùng Bun nếu môi trường hỗ trợ: bun install)

# Khởi chạy server phát triển (chạy tại http://localhost:3000, host 0.0.0.0)
npm run dev
```

### Lệnh kiểm tra lỗi kiểu (Typecheck / Lint)
```bash
# Kiểm tra toàn bộ lỗi kiểu dữ liệu TypeScript (không phát sinh file)
npm run lint
```

### Lệnh đóng gói sản phẩm (Build & Preview)
```bash
# Build mã nguồn thành phẩm ra thư mục dist/
npm run build

# Xem thử (preview) bản build production tại local
npm run preview

# Dọn dẹp bản build và file server cũ
npm run clean
```

### Kiểm thử (Testing)
- **Hiện trạng kiểm thử tự động:** `[CẦN XÁC NHẬN]`
  - Hiện tại **CHƯA CÓ** script test tự động nào trong `package.json` (không có `npm test`, chưa cài đặt Vitest hay Jest).
- **Kiểm thử thủ công (Manual Testing):**
  - Dự án hiện dựa vào tài liệu kịch bản kiểm thử chi tiết gồm **48 test case** tại `docs/kiem-thu-giai-doan-3.md` (bao gồm kiểm thử migration, phân quyền, nộp minh chứng 2 cấp, GPS, v.v.).

### Lệnh Script tiện ích (Admin Data Scripts)
Các script nằm trong thư mục `scripts/`, yêu cầu biến môi trường `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE`:
```powershell
# Windows PowerShell
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE="<service-role-key>"

# 1. Sinh dữ liệu đoàn viên mẫu theo chi đoàn (chứa cờ note 'SEED')
node scripts/seed-members.mjs --per-unit=12

# 2. Tạo tài khoản đăng nhập Supabase Auth cho đoàn viên chưa có tài khoản
node scripts/create-accounts.mjs --limit=10 --role=member
```

### Lệnh Supabase CLI (Edge Functions & Secrets)
```bash
# Đăng nhập và liên kết dự án
supabase login
supabase link --project-ref <your-project-ref>

# Triển khai các Edge Functions
supabase functions deploy admin-create-member-account --no-verify-jwt --yes
supabase functions deploy payos-create-payment --no-verify-jwt --yes
supabase functions deploy payos-webhook --no-verify-jwt --yes

# Cấu hình bí mật (Secrets) cho payOS
supabase secrets set PAYOS_CLIENT_ID=<client-id>
supabase secrets set PAYOS_API_KEY=<api-key>
supabase secrets set PAYOS_CHECKSUM_KEY=<checksum-key>
```

---

## 5. QUY ƯỚC ĐẶT TÊN VÀ CÁCH VIẾT CODE (Coding Standards & Conventions)

### 1. Quy ước đặt tên file và thư mục
- **React Components & Pages:** Đặt theo chuẩn `PascalCase.tsx` (ví dụ: `DashboardPage.tsx`, `ReviewPage.tsx`, `ConfirmDialog.tsx`, `StatusBadge.tsx`).
- **Services, Utilities, Hooks, Data Files:** Đặt theo chuẩn `camelCase.ts` (ví dụ: `supabaseRepository.ts`, `permissions.ts`, `useRepo.ts`, `vietQr.ts`).
- **Database Migrations:** Đặt tên theo mẫu `phaseN_ten_tinh_nang.sql` trong thư mục `supabase/migrations/` (ví dụ: `phase14_attendance_checkin.sql`, `phase15_unit_reports.sql`).

### 2. Quy ước đặt tên biến, thuộc tính và kiểu dữ liệu
- **Cơ sở dữ liệu (Database Schema):** Toàn bộ tên bảng và tên cột dùng chuẩn `snake_case` (ví dụ: `unit_id`, `joined_date`, `is_active`, `task_sub_criteria`, `central_member_code`).
- **Kiểu dữ liệu TypeScript ánh xạ Database:**
  - Khai báo tại `src/data/types.ts` với tiền tố `Db*` (ví dụ: `DbTask`, `DbMember`, `DbCriterionSubmission`, `DbEvidence`).
  - Chuyển đổi từ dữ liệu DB thô sang kiểu TypeScript qua các hàm mapper chuẩn `toXxx(raw)` đặt tại `src/data/supabaseRepository.ts` (ví dụ: `toTask`, `toMemberSubmission`, `toCriterion`).
- **Domain / UI Types:** Khai báo tại `src/types/index.ts` không dùng tiền tố `Db` (ví dụ: `Member`, `Unit`, `Task`).

### 3. Các quy tắc bắt buộc trong toàn bộ dự án (Hard Invariants)

1. **Tuyệt đối cấm sử dụng Modal mặc định của trình duyệt:**
   - **CẤM:** `alert()`, `confirm()`, `prompt()`, `window.confirm()`.
   - **BẮT BUỘC:** Sử dụng hook `useConfirm()` từ `src/components/common/ConfirmDialog.tsx`:
     ```tsx
     const { confirm, prompt } = useConfirm();
     const ok = await confirm({
       title: 'Xác nhận xóa',
       message: 'Hành động này không thể hoàn tác.',
       variant: 'danger',
     });
     ```
2. **Mọi nút bấm phải có tooltip giải thích (`title="..."`):**
   - Mọi thẻ `<button>`, `<Link>`, `<NavLink>` hoặc thành phần tương tác bắt buộc phải có thuộc tính `title="..."` mô tả ngắn gọn chức năng cho người dùng.
3. **Thuật ngữ chuẩn — Không dùng khái niệm "Sự kiện" (Event):**
   - Mọi hoạt động sinh hoạt, phong trào, tình nguyện đều được gọi thống nhất là **"Nhiệm vụ" (`tasks`)**. Tuyệt đối không tạo bảng hay khái niệm `events`.
4. **Idempotent Migrations:**
   - Mọi câu lệnh SQL migration phải đảm bảo chạy lại nhiều lần không sinh lỗi:
     - `CREATE TABLE IF NOT EXISTS ...`
     - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
     - `DROP POLICY IF EXISTS ... ON ...; CREATE POLICY ...`
5. **Tái sử dụng Helper Functions trong schema `private`:**
   - Khi viết RLS Policies trên Supabase, bắt buộc tái sử dụng các hàm đã được tạo sẵn trong schema `private`, không tự định nghĩa lại:
     - `private.my_role()`: Lấy vai trò hiện tại của user.
     - `private.my_member_id()`: Lấy `member_id` gắn với tài khoản đang đăng nhập.
     - `private.my_unit_id()`: Lấy `unit_id` (chi đoàn) của người dùng.
     - `private.is_admin()`: Kiểm tra user có phải `admin` hoặc `super_admin`.
     - `private.is_unit_secretary()`: Kiểm tra user có phải bí thư/phó bí thư chi đoàn.
6. **Không gọi API Supabase trực tiếp từ Component:**
   - Component UI chỉ tương tác thông qua `AppContext` (`useApp()`) hoặc qua `repository`. Tầng Component không tự khởi tạo query `supabase.from(...)` để tránh vỡ tính đóng gói của Repository Pattern.
7. **Định dạng ngày giờ chuẩn tiếng Việt:**
   - Sử dụng các hàm chuẩn từ `src/mock/data.ts`:
     - `formatDateVN(isoString)`: Xuất định dạng `DD/MM/YYYY`.
     - `formatDateTimeVN(isoString)`: Xuất định dạng `HH:mm DD/MM/YYYY`.
8. **Chuẩn giao diện & Màu sắc thương hiệu Đoàn:**
   - Màu chủ đạo là xanh Đoàn thanh niên:
     - Nền/chữ chính: `bg-doan` (`#1F5FBF`), `text-doan`.
     - Màu đậm khi hover: `bg-doan-dark` (`#154690`).
     - Nền nhạt/highlight: `bg-doan-bg` (`#eff6ff`).
   - Font chữ chuẩn: `'Be Vietnam Pro'`.
9. **Bỏ hẳn cơ chế tính điểm thi đua:**
   - Toàn bộ hệ thống **không tính điểm thi đua** (nhiệm vụ không cộng điểm, tiêu chí không tính điểm số hay xếp hạng theo điểm). Ứng dụng tập trung vào công tác quản trị, theo dõi tiến độ nộp minh chứng thực địa (ảnh + GPS), check-in và đánh giá xếp loại chất lượng thực chất.

---

## 6. DANH SÁCH CÁC ĐIỂM CẦN XÁC NHẬN (Uncertainties / Needing Confirmation)

Dưới đây là các điểm phát hiện trong quá trình khảo sát có sự sai lệch giữa tài liệu, mã nguồn hoặc chưa rõ mục đích sử dụng. Theo nguyên tắc, các mục này được đánh dấu rõ ràng, không võ đoán:

1. **`[CẦN XÁC NHẬN]` Sự hiện diện của thư viện `@google/genai`:**
   - Gói `@google/genai` (`^2.4.0`) được cài trong `package.json` và nhắc đến trong `README.md` (di tích từ Google AI Studio template), nhưng mã nguồn `src/` hiện không import hay sử dụng ở bất kỳ chức năng nào.
   - *Cần xác nhận:* Dự án có kế hoạch tích hợp trợ lý ảo / AI cho công tác Đoàn không, hay gói này có thể gỡ bỏ để tối ưu dung lượng?
2. **`[CẦN XÁC NHẬN]` Sự hiện diện của `express`, `pg`, `dotenv` và file `server.js`:**
   - Trong `package.json` có phụ thuộc `express`, `pg`, `@types/pg`, `dotenv` và script `"clean": "rm -rf dist server.js"`, nhưng trong toàn bộ dự án hiện không có file `server.js` hay code chạy backend Node.js nào.
   - *Cần xác nhận:* Đây có phải là tàn dư từ phiên bản prototype/SSR trước đây có thể dọn dẹp, hay có một script ngoài phục vụ build/deploy?
3. **`[CẦN XÁC NHẬN]` Tự động hóa kiểm thử (Automated Tests):**
   - Dự án hiện không có bất kỳ file test nào (`*.test.ts`, `*.spec.tsx`) và không có script `test` trong `package.json`. Hiện chỉ có tài liệu kiểm thử tay `docs/kiem-thu-giai-doan-3.md`.
   - *Cần xác nhận:* Có cần thiết lập framework kiểm thử tự động (như Vitest + Testing Library) cho các module quan trọng như tính điểm KPI, phân quyền permissions, và mapper hay không?
4. **`[CẦN XÁC NHẬN]` Quy tắc "Nộp đủ" của Chi đoàn trước khi gửi bài tổng hợp:**
   - Trong `docs/phan-tich-luong-nghiep-vu.md` ghi nhận: Hàm `listTaskParticipants(taskId, unitId)` đã được viết nhưng chưa được gọi ở giao diện. Hàm `submitTaskResult` (nộp tổng hợp chi đoàn) hiện cho phép gửi bài bất kể số lượng đoàn viên nộp là bao nhiêu.
   - *Cần xác nhận:* Nghiệp vụ thực tế yêu cầu điều kiện gì để bí thư chi đoàn được bấm nộp tổng hợp (ví dụ: tối thiểu bao nhiêu % đoàn viên nộp, hay chỉ cần $\ge 1$ bài duyệt)?
5. **`[ĐÃ XÁC NHẬN - BỎ HẲN]` Điểm thi đua của Nhiệm vụ và Tiêu chí:**
   - **Xác nhận từ tác giả:** Đã **bỏ hẳn việc tính điểm** trong toàn bộ hệ thống vì thấy không cần thiết.
   - *Lưu ý kỹ thuật:* Nhiệm vụ và tiêu chí không còn tính hay cộng dồn điểm số thi đua. Các trường như `contribution_score` (trong bảng `task_sub_criteria` và form tạo nhiệm vụ), `max_score`, `approved_score`, `self_score` và công thức tính điểm 100/150 trên Dashboard/KPI là tàn dư thiết kế cũ và không dùng đến.
6. **`[CẦN XÁC NHẬN]` Phân quyền RLS trên bảng `evidences`:**
   - Hiện tại bảng `evidences` trong PostgreSQL chưa được bật Row Level Security (RLS) theo chi đoàn (chỉ có RLS trên Storage bucket). Bất kỳ tài khoản đăng nhập nào cũng có thể query toàn bộ bảng `evidences`.
   - *Cần xác nhận:* Có cần bổ sung migration bật RLS cho bảng `evidences` để giới hạn đoàn viên và bí thư chi đoàn chỉ xem được minh chứng của chi đoàn mình?
7. **`[CẦN XÁC NHẬN]` Hàm `updateTask` trong `AppContext.tsx`:**
   - Hàm `updateTask` trong `AppContext` hiện chỉ gán đè vào state memory mà chưa có hàm ghi xuống database Supabase (giao diện hiện tại cũng chưa mở nút sửa nhiệm vụ đã phát động).
   - *Cần xác nhận:* Có cần phát triển tính năng chỉnh sửa nhiệm vụ trên DB hay giữ nguyên quy tắc nhiệm vụ đã phát động thì không được sửa?
8. **`[CẦN XÁC NHẬN]` Chỉ số Dashboard `overdueUnitsCount` và `dueSoon7DaysCount`:**
   - Trong `src/data/supabaseRepository.ts`, hai chỉ số này hiện đang trả về giá trị cố định là `0` kèm chú thích `// giai đoạn 2`.
   - *Cần xác nhận:* Thời điểm dự kiến triển khai truy vấn thật cho 2 chỉ số này trên Supabase.

