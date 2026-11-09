-- =====================================================================
-- GIAI ĐOẠN 14b · SỬA LỖI RLS TRÊN BẢNG evidences
--
-- LỖI GÌ:
--   phase14_attendance_checkin.sql có câu
--       alter table public.evidences enable row level security;
--   nhưng chỉ tạo DUY NHẤT một policy SELECT cho bí thư chi đoàn.
--
--   Bảng `evidences` thuộc schema gốc 23 bảng, KHÔNG nằm trong file migration
--   nào và CHƯA TỪNG bật RLS. Khi bật RLS mà không có policy INSERT/SELECT,
--   Postgres mặc định CHẶN TẤT CẢ -> đoàn viên không nộp được minh chứng
--   (báo "Bạn không có quyền thực hiện thao tác này").
--
-- SỬA GÌ:
--   Bổ sung đầy đủ policy cho mọi thao tác đang dùng, theo đúng quy ước
--   của các bảng giai đoạn 2 khác (private.my_role() / my_member_id() /
--   my_unit_id() / is_admin() / is_unit_secretary()).
--
-- Chạy SAU phase14. An toàn khi chạy lại (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Đảm bảo RLS đang bật (giữ nguyên ý định ban đầu)
-- ---------------------------------------------------------------------
alter table public.evidences enable row level security;

-- ---------------------------------------------------------------------
-- 2. SELECT — ai được đọc minh chứng
--    - admin / super admin: tất cả
--    - đoàn viên: minh chứng của chính mình
--    - bí thư / phó bí thư chi đoàn: minh chứng của đơn vị mình
--    - staff (Đoàn xã): tất cả (để duyệt và đối chiếu)
-- ---------------------------------------------------------------------
drop policy if exists evidences_select on public.evidences;
create policy evidences_select on public.evidences
  for select to authenticated
  using (
    private.is_admin()
    or private.my_role() = 'staff'
    or member_id = private.my_member_id()
    or (private.is_unit_secretary() and unit_id = private.my_unit_id())
  );

-- Policy cũ do phase14 tạo ra (chỉ bí thư) — bỏ để không trùng lặp.
-- (Đã bao trùm trong policy evidences_select ở trên.)
drop policy if exists evidences_select_secretary_unit on public.evidences;

-- ---------------------------------------------------------------------
-- 3. INSERT — ai được thêm minh chứng
--
--    Cả 3 luồng nộp đều ghi `member_id` = chính người bấm nộp:
--      • submitMemberResult      (đoàn viên nộp bài cá nhân)
--      • submitTaskResult        (bí thư nộp kết quả chi đoàn)
--      • submitCriterionSubmission (nộp minh chứng tiêu chí)
--    nên điều kiện `member_id = private.my_member_id()` phủ đúng cả 3,
--    kể cả khi bài nộp thuộc về chi đoàn chứ không phải cá nhân.
--
--    Admin/staff được thêm hộ (nhập liệu, di chuyển dữ liệu).
-- ---------------------------------------------------------------------
drop policy if exists evidences_insert on public.evidences;
create policy evidences_insert on public.evidences
  for insert to authenticated
  with check (
    private.is_admin()
    or private.my_role() = 'staff'
    or (
      member_id = private.my_member_id()
      and unit_id = private.my_unit_id()
    )
  );

-- ---------------------------------------------------------------------
-- 4. UPDATE — ai được sửa minh chứng
--    - admin / staff: tất cả
--    - đoàn viên: chỉ minh chứng của mình và khi CHƯA bị khoá
--      (is_locked = true nghĩa là đã dùng để duyệt, không cho sửa nữa)
-- ---------------------------------------------------------------------
drop policy if exists evidences_update on public.evidences;
create policy evidences_update on public.evidences
  for update to authenticated
  using (
    private.is_admin()
    or private.my_role() = 'staff'
    or (member_id = private.my_member_id() and is_locked = false)
  )
  with check (
    private.is_admin()
    or private.my_role() = 'staff'
    or (member_id = private.my_member_id() and is_locked = false)
  );

-- ---------------------------------------------------------------------
-- 5. DELETE — ai được xoá minh chứng
--    - admin / staff: tất cả
--    - đoàn viên: chỉ minh chứng của mình và khi chưa bị khoá
--      (dùng khi nộp lại: submitMemberResult xoá bộ ảnh cũ trước khi thêm mới)
--    - bí thư chi đoàn: minh chứng của đơn vị mình, chưa bị khoá
-- ---------------------------------------------------------------------
drop policy if exists evidences_delete on public.evidences;
create policy evidences_delete on public.evidences
  for delete to authenticated
  using (
    private.is_admin()
    or private.my_role() = 'staff'
    or (member_id = private.my_member_id() and is_locked = false)
    or (private.is_unit_secretary() and unit_id = private.my_unit_id() and is_locked = false)
  );

commit;

-- =====================================================================
-- KIỂM TRA SAU KHI CHẠY
-- =====================================================================
-- Phải thấy 4 policy: evidences_select / evidences_insert / evidences_update / evidences_delete
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'evidences'
order by policyname;

-- RLS phải đang bật
select relname, relrowsecurity as rls_bat
from pg_class
where relname = 'evidences' and relnamespace = 'public'::regnamespace;