-- =====================================================================
-- GIAI ĐOẠN 13 · TỰ ĐỘNG ĐỒNG BỘ QUYỀN KHI BỔ NHIỆM BAN CHẤP HÀNH
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Vấn đề: bổ nhiệm Bí thư trong trang Ban Chấp hành chỉ ghi vào
-- unit_committees. Bảng profiles.role_id và members.current_position
-- vẫn giữ nguyên 'member' → tài khoản không có quyền tạo nhiệm vụ.
--
-- Giải pháp: trigger tự động đồng bộ 3 nơi mỗi khi unit_committees thay đổi.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper nhận diện bí thư chi đoàn (3 nguồn)
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
-- 2. Trigger đồng bộ quyền + chức vụ
-- ---------------------------------------------------------------------
create or replace function private.sync_committee_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id     bigint;
  v_position      text;
  v_role_secretary bigint;
  v_role_member    bigint;
begin
  if tg_op = 'DELETE' then
    v_member_id := old.member_id;
  else
    v_member_id := new.member_id;
  end if;

  if v_member_id is null then
    return coalesce(new, old);
  end if;

  select id into v_role_secretary from public.roles where name = 'unit_secretary';
  select id into v_role_member    from public.roles where name = 'member';

  -- Chức vụ đang giữ (ưu tiên Bí thư > Phó Bí thư)
  select c.position into v_position
  from public.unit_committees c
  where c.member_id = v_member_id
    and c.term_end is null
    and c.position in ('secretary', 'deputy_secretary')
  order by case c.position when 'secretary' then 1 else 2 end
  limit 1;

  if v_position is not null then
    -- ĐANG GIỮ CHỨC: nâng lên unit_secretary.
    -- Chỉ nâng khi đang là 'member' — không hạ admin/super_admin xuống.
    update public.profiles
    set role_id = v_role_secretary
    where member_id = v_member_id
      and role_id = v_role_member;

    -- Đồng bộ chức vụ trong hồ sơ đoàn viên
    if v_position = 'secretary' then
      update public.members
      set current_position = 'secretary'
      where id = v_member_id
        and current_position <> 'secretary';
    else
      update public.members
      set current_position = 'deputy_secretary'
      where id = v_member_id
        and current_position = 'member';
    end if;
  else
    -- HẾT NHIỆM KỲ: trả về member (chỉ khi đang là unit_secretary)
    update public.profiles
    set role_id = v_role_member
    where member_id = v_member_id
      and role_id = v_role_secretary;

    update public.members
    set current_position = 'member'
    where id = v_member_id
      and current_position in ('secretary', 'deputy_secretary');
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_committee_role on public.unit_committees;
create trigger trg_sync_committee_role
  after insert or update or delete on public.unit_committees
  for each row execute function private.sync_committee_role();

-- ---------------------------------------------------------------------
-- 3. ĐỒNG BỘ LẠI DỮ LIỆU CŨ (backfill)
--    Áp dụng cho mọi nhân sự đã bổ nhiệm trước khi có trigger.
-- ---------------------------------------------------------------------
do $$
declare
  v_role_secretary bigint;
  v_role_member    bigint;
  r record;
begin
  select id into v_role_secretary from public.roles where name = 'unit_secretary';
  select id into v_role_member    from public.roles where name = 'member';

  -- 3a. Đang giữ chức bí thư / phó bí thư -> nâng quyền
  for r in
    select
      c.member_id,
      (array_agg(c.position order by case c.position when 'secretary' then 1 else 2 end))[1] as position
    from public.unit_committees c
    where c.term_end is null
      and c.position in ('secretary', 'deputy_secretary')
    group by c.member_id
  loop
    update public.profiles
    set role_id = v_role_secretary
    where member_id = r.member_id
      and role_id = v_role_member;

    if r.position = 'secretary' then
      update public.members
      set current_position = 'secretary'
      where id = r.member_id
        and current_position <> 'secretary';
    else
      update public.members
      set current_position = 'deputy_secretary'
      where id = r.member_id
        and current_position = 'member';
    end if;
  end loop;

  -- 3b. Không còn giữ chức -> hạ về member
  for r in
    select p.member_id
    from public.profiles p
    join public.roles ro on ro.id = p.role_id
    where ro.name = 'unit_secretary'
      and p.member_id is not null
      and not exists (
        select 1 from public.unit_committees c
        where c.member_id = p.member_id
          and c.term_end is null
          and c.position in ('secretary', 'deputy_secretary')
      )
  loop
    update public.profiles
    set role_id = v_role_member
    where member_id = r.member_id
      and role_id = v_role_secretary;

    update public.members
    set current_position = 'member'
    where id = r.member_id
      and current_position in ('secretary', 'deputy_secretary');
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Chính sách RLS dùng helper mới (thay cho my_role())
-- ---------------------------------------------------------------------
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
-- 5. KIỂM TRA kết quả
-- ---------------------------------------------------------------------
select
  u.email,
  r.name                          as role,
  p.member_id,
  m.full_name,
  m.current_position,
  private.is_unit_secretary()     as toi_la_bi_thu
from public.profiles p
join auth.users u on u.id = p.id
left join public.roles r on r.id = p.role_id
left join public.members m on m.id = p.member_id
order by r.name, u.email;