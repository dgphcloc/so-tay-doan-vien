# DATA CONTRACT: HỆ THỐNG QUẢN TRỊ ĐOÀN XÃ

Tài liệu đặc tả hợp đồng truy cập dữ liệu giữa tầng Giao diện (React UI) và tầng Dữ liệu (Repository / Supabase Backend).

---

## 1. Bảng Đối ứng Màn hình → Hàm Repository → Bảng/Trường Đọc/Ghi

| Màn hình (Route) | Hàm Repository được gọi | Bảng / Trường ĐỌC | Bảng / Trường GHI |
| :--- | :--- | :--- | :--- |
| **Tổng quan / Dashboard** (`/`) | `getDashboard(year)`<br>`calculateUnitScores(year)`<br>`listPendingReviews(...)` | **Đọc:**<br>- `tasks`: `id`, `due_date`, `status`<br>- `task_results`: `status`, `is_overdue`, `unit_id`, `completed_at`<br>- `criterion_submissions`: `status`, `approved_score`, `unit_id`<br>- `members`: `is_active`, `joined_date`, `birth_date`<br>- `units`: `id`, `name`, `is_active`<br>- `yearly_settings`: `matured_age` | Không ghi (Chỉ đọc) |
| **Duyệt minh chứng** (`/duyet`) | `listPendingReviews(tab, filters)`<br>`getReviewDetail(kind, id)`<br>`approve(...)`<br>`reject(...)` | **Đọc:**<br>- `task_results`, `tasks`, `units`<br>- `criterion_submissions`, `sub_criteria`<br>- `evidences`: `file_hash`, `captured_at`, `lat`, `lng`, `url` | **Ghi:**<br>- `task_results`: `status`, `reviewed_by`, `reviewed_at`, `review_note`<br>- `criterion_submissions`: `status`, `approved_score`, `reviewed_by`, `reviewed_at`, `review_note`<br>- `audit_logs`: bản ghi thao tác duyệt/từ chối |
| **Nhiệm vụ** (`/nhiem-vu`) | `listTasks(status)`<br>`getTask(id)`<br>`createTask(input)`<br>`publishTask(id)`<br>`closeTask(id)`<br>`deleteTask(id)`<br>`cloneTask(id)`<br>`remindUnit(taskId, unitId)`<br>`remindAllUnsubmitted(taskId)` | **Đọc:**<br>- `tasks`<br>- `task_units`<br>- `task_registrations`<br>- `task_sub_criteria`<br>- `task_results`<br>- `units`<br>- `sub_criteria` | **Ghi:**<br>- `tasks`: `INSERT`, `UPDATE` (`status`), `DELETE`<br>- `task_units`: `INSERT`, `DELETE`<br>- `task_sub_criteria`: `INSERT`, `DELETE`<br>- `notifications`: `INSERT` (gửi thông báo khi đăng/nhắc) |
| **Tiêu chí** (`/tieu-chi`) | `listCriteriaSets(year)`<br>`getCriteriaTree(setId)`<br>`saveCriteriaNode(type, action, data)`<br>`reorderCriteriaNodes(...)`<br>`cloneCriteriaSetFromPreviousYear(...)` | **Đọc:**<br>- `criteria_sets`<br>- `criteria_sections`<br>- `criteria`<br>- `sub_criteria`<br>- `criterion_submissions` (kiểm tra ràng buộc đã có chi đoàn chấm chưa) | **Ghi:**<br>- `criteria_sections`: `INSERT`, `UPDATE`, `DELETE`, `stt`<br>- `criteria`: `INSERT`, `UPDATE`, `DELETE`, `stt`<br>- `sub_criteria`: `INSERT`, `UPDATE`, `DELETE`<br>- `criteria_sets`: `INSERT` (khi nhân bản năm mới)<br>- `yearly_settings`: `criteria_set_id` (khi chốt) |
| **Nhắc nhở** (`/nhac-nho`) | `listWarnings(tab)`<br>`resolveWarning(id)`<br>`sendNotification(input)` | **Đọc:**<br>- `warnings`<br>- `units`<br>- `tasks`<br>- `sub_criteria` | **Ghi:**<br>- `warnings`: `UPDATE` (`resolved_at`)<br>- `notifications`: `INSERT` (thông báo đến bí thư) |
| **Chi đoàn** (`/chi-doan`) | `listUnits(filters)`<br>`getUnit(id)`<br>`saveUnit(id, updates)`<br>`deactivateUnit(id)` | **Đọc:**<br>- `units`<br>- `unit_types`<br>- `unit_committees`<br>- `members`<br>- `task_units`<br>- `task_results`<br>- `criterion_submissions`<br>- `warnings` | **Ghi:**<br>- `units`: `UPDATE` (`is_active`, `union_member_count`, `youth_count`, ...) |
| **Đoàn viên** (`/doan-vien`) | `listMembers(filters)`<br>`getMember(id)`<br>`saveMember(input)`<br>`deleteMember(id)`<br>`importMembers(rows)` | **Đọc:**<br>- `members`<br>- `units`<br>- `profiles`<br>- `unit_committees`<br>- `task_registrations`<br>- `yearly_settings`: `matured_age` | **Ghi:**<br>- `members`: `INSERT`, `UPDATE`, `DELETE` |
| **Ban Chấp hành** (`/bch`, `/ban-chap-hanh`) | `listCommittees(unitId, term)`<br>`addCommitteeMember(input)`<br>`endCommitteeTerm(id, date)` | **Đọc:**<br>- `unit_committees`<br>- `members`<br>- `units` | **Ghi:**<br>- `unit_committees`: `INSERT`, `UPDATE` (`term_end`) |
| **Báo cáo** (`/bao-cao`) | `listReports()`<br>`createReport(input)` | **Đọc:**<br>- `reports` | **Ghi:**<br>- `reports`: `INSERT` (lưu bản chụp `data` JSON không đổi theo thời gian) |
| **Cấu hình** (`/cau-hinh`) | `getYearlySettings(year)`<br>`updateYearlySettings(...)`<br>`listUnitTypes()`<br>`saveUnitType(...)`<br>`deleteUnitType(...)`<br>`listEthnicities()` | **Đọc:**<br>- `yearly_settings`<br>- `unit_types`<br>- `ethnicities`<br>- `units` (kiểm tra loại chi đoàn có đang dùng) | **Ghi:**<br>- `yearly_settings`: `UPDATE`<br>- `unit_types`: `INSERT`, `UPDATE`, `DELETE` |
| **Tài khoản & Quyền** (`/tai-khoan`) | `listProfiles()`<br>`setProfileRole(id, role)`<br>`toggleProfileActive(id)`<br>`linkProfileMember(id, memberId)` | **Đọc:**<br>- `profiles`<br>- `members` | **Ghi:**<br>- `profiles`: `UPDATE` (`role_id`, `is_active`, `member_id`) |
| **Nhật ký** (`/nhat-ky`) | `listAuditLogs(filters)` | **Đọc:**<br>- `audit_logs`<br>- `members` | Không ghi trực tiếp (hệ thống tự sinh log khi có hành động) |

---

## 2. Danh sách Trường hoặc Bảng UI Dùng Nhưng KHÔNG Có Trong 23 Bảng Chuẩn

| Tên bảng / trường | Phân loại | Mục đích sử dụng trong UI | Giải pháp khi tích hợp Supabase |
| :--- | :--- | :--- | :--- |
| `task_sub_criteria` | Bảng quan hệ N:N | Lưu liên kết giữa nhiệm vụ và tiêu chí thi đua kèm điểm đóng góp `contribution_score`. | Tạo bảng trung gian `task_sub_criteria(task_id, sub_criterion_id, contribution_score)`. |
| `evidences.uploaded_at` | Trường bổ sung | Lưu thời gian tải lên máy chủ ngoài thời gian chụp ảnh `captured_at`. | Thêm cột `uploaded_at TIMESTAMPTZ DEFAULT now()` vào bảng `evidences`. |
| `evidences.file_name` | Trường bổ sung | Tên file hiển thị thân thiện trên UI. | Thêm cột `file_name TEXT` vào bảng `evidences`. |
| `evidences.is_locked` | Trường cờ khóa | Khóa không cho phép sửa/xóa minh chứng sau khi đã nộp hoặc duyệt. | Thêm cột `is_locked BOOLEAN DEFAULT false` vào bảng `evidences`. |
| `sub_criteria.unit_id` | Trường quan hệ | Tùy chọn gán tiêu chí chỉ riêng cho 1 chi đoàn cụ thể (ngoài `unit_type_id`). | Thêm cột `unit_id UUID REFERENCES units(id)` vào bảng `sub_criteria`. |
| `reports.data` | Cột JSONB bản chụp | Chứa toàn bộ dữ liệu thống kê tĩnh tại thời điểm xuất báo cáo. | Khai báo trường kiểu `JSONB` trong Supabase table `reports`. |
| `task_results.submitted_by` | Trường lưu người nộp | Lưu `member_id` của cán bộ chi đoàn bấm nộp nhiệm vụ. | Thêm cột `submitted_by UUID REFERENCES members(id)` vào `task_results`. |

---

## 3. Danh sách Mọi Chỗ Dữ Liệu Tự Bịa / Hard-code Trong UI

1. **Người dùng đang đăng nhập & Cán bộ ký duyệt:**
   - Trong giao diện duyệt `/duyet`, id người duyệt đang tạm lấy từ tài khoản thường trực `keyMemberIds.phoBiThu1` (Đ/c Nguyễn Văn Cương - Phó Bí thư Đoàn xã).
   - Khi tạo nhiệm vụ/báo cáo, người tạo tạm gán `keyMemberIds.biThuXa` (Đ/c Trần Thị Mai - Bí thư Đoàn xã).
   - Khi chuyển sang Supabase: Sẽ thay bằng `auth.uid()` từ Firebase/Supabase Auth session.

2. **Ô chuyển quyền "Xem với quyền" tại Header:**
   - Giá trị dropdown: `super_admin`, `admin`, `staff` được quản lý bởi state `currentRole` để kiểm thử trải nghiệm giao diện ngay trên trình duyệt mà không cần đăng xuất.
   - Khi chuyển sang Supabase: Sẽ đọc trực tiếp vai trò từ bảng `profiles.role_id` của tài khoản đăng nhập.

3. **Tọa độ thực địa mặc định bản đồ:**
   - Khi tạo nhiệm vụ mới hoặc chi đoàn khai báo GPS, tọa độ mặc định đang lấy trung tâm xã Tân Phú: Lat `10.4215`, Lng `106.3218`.

4. **Trạng thái mô phỏng chụp ảnh thực địa:**
   - Chức năng chụp camera thực địa tạo hash SHA-256 giả lập và gán tọa độ ngẫu nhiên xung quanh địa bàn xã.

---

## 4. Công thức Chính xác Của Từng Số Liệu Dashboard

Tất cả các số liệu này được tính toán hoàn toàn bên trong `Repository.getDashboard(year)` và `Repository.calculateUnitScores(year)`, không tính toán trong React Component:

1. **Chờ duyệt (`pendingCount`):**
   - Công thức: `count(task_results where status = 'pending') + count(criterion_submissions where status = 'pending')`.
   - Trong đó:
     - `taskPendingCount`: Số lượng kết quả nhiệm vụ có `status = 'pending'`.
     - `criteriaPendingCount`: Số lượng tự chấm tiêu chí có `status = 'pending'`.

2. **Chi đoàn trễ hạn (`overdueUnitsCount`):**
   - Công thức: Số lượng `unit_id` duy nhất (`Set<unit_id>`) thỏa mãn:
     - Có ít nhất một `task_results` gắn với chi đoàn đó có `is_overdue = true`, HOẶC
     - Có nhiệm vụ được giao ở trạng thái `pending` mà ngày hiện tại đã vượt quá `tasks.due_date`.

3. **Nhiệm vụ sắp hết hạn trong 7 ngày (`dueSoon7DaysCount`):**
   - Công thức: Đếm các bản ghi trong bảng `tasks` thỏa mãn đồng thời:
     - `status = 'published'`
     - `tasks.due_date >= now()`
     - `tasks.due_date <= now() + 7 days`.

4. **Đoàn viên mới kết nạp trong năm (`newMembersCount`):**
   - Công thức: Đếm số `members` có `EXTRACT(YEAR FROM joined_date) = year` (năm đang chọn trên hệ thống, mặc định 2026).

5. **Đoàn viên đã trưởng thành Đoàn (`maturedCount`):**
   - Công thức: Đếm số `members` còn hoạt động (`is_active = true`) có:
     `year - EXTRACT(YEAR FROM birth_date) >= yearly_settings.matured_age` (mặc định ngưỡng tuổi là 30).

6. **Điểm tổng chi đoàn (`UnitScoreCalculation.totalScore`):**
   - Công thức: `totalScore = criteriaScore + taskScore`.
   - Trong đó:
     - `criteriaScore`: Tổng `approved_score` của các bản ghi `criterion_submissions` thuộc chi đoàn có `status = 'approved'`.
     - `taskScore`: Tổng `tasks.max_score` của các bản ghi `task_results` thuộc chi đoàn có `status = 'approved'`.
   - Tỷ lệ hoàn thành (`completionRate`): `Math.round((totalScore / 150) * 100)%` (với thang điểm chuẩn: 100 điểm tiêu chí + 50 điểm nhiệm vụ).

7. **Cảnh báo minh chứng bất thường (`EvidenceAuditWarning`):**
   - `is_missing_gps`: `evidence.lat === null || evidence.lng === null`.
   - `is_duplicate_hash`: Đếm trong toàn bộ bảng `evidences` có nhiều hơn 1 bản ghi có cùng `file_hash`.
   - `is_captured_after_deadline`: `evidence.captured_at > task.due_date` (hoặc `sub_criteria.deadline`).
