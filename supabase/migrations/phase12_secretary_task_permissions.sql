-- =====================================================================
-- GIAI ĐOẠN 12 · CHO PHÉP BÍ THƯ CHI ĐOÀN TẠO NHIỆM VỤ TỪ TIÊU CHÍ
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Bối cảnh: Trước đây bảng tasks / task_units / task_sub_criteria chỉ có
-- policy SELECT. Bí thư chi đoàn bấm "Tạo nhiệm vụ" bị RLS chặn với lỗi
-- "Bạn không có quyền thực hiện thao tác này".
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BẢNG tasks
-- ---------------------------------------------------------------------
-- Admin: toàn quyền
drop policy if exists tasks_write_admin on public.tasks;
create policy tasks_write_admin on public.tasks
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Bí thư chi đoàn: được tạo / sửa / xóa nhiệm vụ do CHÍNH MÌNH phát động
drop policy if exists tasks_insert_secretary on public.tasks;
create policy tasks_insert_secretary on public.tasks
  for insert to authenticated
  with check (
    private.my_role() = 'unit_secretary'
    and assigned_by = private.my_member_id()
  );

drop policy if exists tasks_update_secretary on public.tasks;
create policy tasks_update_secretary on public.tasks
  for update to authenticated
  using (
    private.my_role() = 'unit_secretary'
    and assigned_by = private.my_member_id()
  )
  with check (
    private.my_role() = 'unit_secretary'
    and assigned_by = private.my_member_id()
  );

drop policy if exists tasks_delete_secretary on public.tasks;
create policy tasks_delete_secretary on public.tasks
  for delete to authenticated
  using (
    private.my_role() = 'unit_secretary'
    and assigned_by = private.my_member_id()
  );

-- ---------------------------------------------------------------------
-- 2. BẢNG task_units (chi đoàn được giao)
-- ---------------------------------------------------------------------
drop policy if exists task_units_write_admin on public.task_units;
create policy task_units_write_admin on public.task_units
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Bí thư chi đoàn: chỉ được giao cho CHÍNH chi đoàn mình,
-- và chỉ với nhiệm vụ do chính mình phát động.
drop policy if exists task_units_write_secretary on public.task_units;
create policy task_units_write_secretary on public.task_units
  for all to authenticated
  using (
    private.my_role() = 'unit_secretary'
    and unit_id = private.my_unit_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_units.task_id
        and t.assigned_by = private.my_member_id()
    )
  )
  with check (
    private.my_role() = 'unit_secretary'
    and unit_id = private.my_unit_id()
    and exists (
      select 1 from public.tasks t
      where t.id = task_units.task_id
        and t.assigned_by = private.my_member_id()
    )
  );

-- ---------------------------------------------------------------------
-- 3. BẢNG task_sub_criteria (gắn tiêu chí nguồn)
-- ---------------------------------------------------------------------
drop policy if exists task_sub_criteria_write_secretary on public.task_sub_criteria;
create policy task_sub_criteria_write_secretary on public.task_sub_criteria
  for all to authenticated
  using (
    private.my_role() = 'unit_secretary'
    and exists (
      select 1 from public.tasks t
      where t.id = task_sub_criteria.task_id
        and t.assigned_by = private.my_member_id()
    )
  )
  with check (
    private.my_role() = 'unit_secretary'
    and exists (
      select 1 from public.tasks t
      where t.id = task_sub_criteria.task_id
        and t.assigned_by = private.my_member_id()
    )
  );

-- ---------------------------------------------------------------------
-- 4. task_results: bí thư chi đoàn được duyệt bài của chi đoàn mình
--    (đã có từ phase trước, nhắc lại cho chắc nếu chưa có)
-- ---------------------------------------------------------------------
drop policy if exists task_results_review_secretary on public.task_results;
create policy task_results_review_secretary on public.task_results
  for update to authenticated
  using (
    private.is_admin()
    or (
      private.my_role() = 'unit_secretary'
      and unit_id = private.my_unit_id()
      and exists (
        select 1 from public.tasks t
        where t.id = task_results.task_id
          and t.assigned_by = private.my_member_id()
      )
    )
  )
  with check (
    private.is_admin()
    or (
      private.my_role() = 'unit_secretary'
      and unit_id = private.my_unit_id()
    )
  );

-- Kiểm tra: liệt kê các policy hiện có trên tasks
select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('tasks', 'task_units', 'task_sub_criteria', 'task_results')
order by tablename, cmd, policyname;