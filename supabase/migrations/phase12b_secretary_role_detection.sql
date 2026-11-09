-- =====================================================================
-- GIAI ĐOẠN 12b · SỬA POLICY: NHẬN DIỆN BÍ THƯ CHI ĐOÀN LINH HOẠT
-- Chạy SAU phase12. An toàn khi chạy lại.
--
-- Vấn đề: phase12 kiểm tra private.my_role() = 'unit_secretary'.
-- Nhưng nhiều tài khoản đã được bổ nhiệm làm bí thư (trong bảng members
-- hoặc unit_committees) mà profiles.role_id vẫn là 'member' → bị chặn.
--
-- Giải pháp: thêm helper private.is_unit_secretary() nhận diện theo
--   (1) profiles.role_id = unit_secretary, HOẶC
--   (2) members.current_position là secretary / deputy_secretary
--       của chi đoàn mà tài khoản đang trực thuộc.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Hàm helper
-- ---------------------------------------------------------------------
create or replace function private.is_unit_secretary()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.name = 'unit_secretary'
  )
  or exists (
    select 1
    from public.profiles p
    join public.members m on m.id = p.member_id
    where p.id = auth.uid()
      and m.is_active = true
      and m.current_position in ('secretary', 'deputy_secretary')
  )
  -- Bổ sung: có tên trong Ban Chấp hành đang giữ chức bí thư / phó bí thư
  or exists (
    select 1
    from public.profiles p
    join public.unit_committees c
      on c.member_id = p.member_id
     and c.term_end is null
     and c.position in ('secretary', 'deputy_secretary')
    where p.id = auth.uid()
  );
$$;

revoke all on function private.is_unit_secretary() from public;
grant execute on function private.is_unit_secretary() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Viết lại các policy dùng helper mới
-- ---------------------------------------------------------------------

-- tasks: tạo / sửa / xóa nhiệm vụ của chính mình
drop policy if exists tasks_insert_secretary on public.tasks;
create policy tasks_insert_secretary on public.tasks
  for insert to authenticated
  with check (
    private.is_unit_secretary()
    and assigned_by = private.my_member_id()
  );

drop policy if exists tasks_update_secretary on public.tasks;
create policy tasks_update_secretary on public.tasks
  for update to authenticated
  using (
    private.is_unit_secretary()
    and assigned_by = private.my_member_id()
  )
  with check (
    private.is_unit_secretary()
    and assigned_by = private.my_member_id()
  );

drop policy if exists tasks_delete_secretary on public.tasks;
create policy tasks_delete_secretary on public.tasks
  for delete to authenticated
  using (
    private.is_unit_secretary()
    and assigned_by = private.my_member_id()
  );

-- task_units: giao cho chính chi đoàn mình
drop policy if exists task_units_write_secretary on public.task_units;
create policy task_units_write_secretary on public.task_units
  for all to authenticated
  using (
    private.is_unit_secretary()
    and unit_id = private.my_unit_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_units.task_id
        and t.assigned_by = private.my_member_id()
    )
  )
  with check (
    private.is_unit_secretary()
    and unit_id = private.my_unit_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_units.task_id
        and t.assigned_by = private.my_member_id()
    )
  );

-- task_sub_criteria: gắn tiêu chí nguồn
drop policy if exists task_sub_criteria_write_secretary on public.task_sub_criteria;
create policy task_sub_criteria_write_secretary on public.task_sub_criteria
  for all to authenticated
  using (
    private.is_unit_secretary()
    and exists (
      select 1 from public.tasks t
      where t.id = task_sub_criteria.task_id
        and t.assigned_by = private.my_member_id()
    )
  )
  with check (
    private.is_unit_secretary()
    and exists (
      select 1 from public.tasks t
      where t.id = task_sub_criteria.task_id
        and t.assigned_by = private.my_member_id()
    )
  );

-- task_results: duyệt bài của chi đoàn mình
drop policy if exists task_results_review_secretary on public.task_results;
create policy task_results_review_secretary on public.task_results
  for update to authenticated
  using (
    private.is_admin()
    or (
      private.is_unit_secretary()
      and unit_id = private.my_unit_id()
    )
  )
  with check (
    private.is_admin()
    or (
      private.is_unit_secretary()
      and unit_id = private.my_unit_id()
    )
  );

-- ---------------------------------------------------------------------
-- 3. Kiểm tra: tài khoản hiện tại có được nhận diện là bí thư không?
-- ---------------------------------------------------------------------
select
  auth.uid()                            as uid,
  private.my_role()                     as role_hien_tai,
  private.my_member_id()                as member_id,
  private.my_unit_id()                  as unit_id,
  private.is_admin()                    as la_admin,
  private.is_unit_secretary()           as la_bi_thu;