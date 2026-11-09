-- =====================================================================
-- GIAI ĐOẠN 10 · BỘ CÔNG CỤ BÁN PHẦN MỀM, DUYỆT TỰ ĐĂNG KÝ GOOGLE,
-- LÊN LỊCH GỬI THÔNG BÁO VÀ CHỈ TIÊU ĐOÀN VIÊN MỚI
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BỔ SUNG CỘT BẢNG MEMBERS: TRẠNG THÁI DUYỆT ĐĂNG KÝ & ĐOÀN VIÊN MỚI
-- ---------------------------------------------------------------------
alter table public.members
  add column if not exists approval_status text not null default 'approved'
    check (approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists is_newly_admitted boolean not null default false,
  add column if not exists rejection_reason text;

comment on column public.members.approval_status is 'Trạng thái duyệt của bí thư chi đoàn khi tự đăng ký: pending (chờ duyệt), approved (chính thức), rejected (từ chối)';
comment on column public.members.is_newly_admitted is 'Đánh dấu đoàn viên mới kết nạp trong năm để tính chỉ tiêu phát triển đoàn viên';
comment on column public.members.rejection_reason is 'Lý do từ chối nếu không phải đoàn viên của chi đoàn';

-- ---------------------------------------------------------------------
-- 2. BẢNG LÊN LỊCH GỬI THÔNG BÁO TỰ ĐỘNG (SCHEDULED NOTIFICATIONS)
-- ---------------------------------------------------------------------
create table if not exists public.scheduled_notifications (
  id              bigserial primary key,
  title           text not null,
  content         text not null,
  level           text not null default 'yellow' check (level in ('yellow', 'orange', 'red')),
  recipient_type  text not null check (recipient_type in ('unit', 'member', 'all')),
  target_id       bigint, -- ID của chi đoàn hoặc đoàn viên
  scheduled_at    timestamptz not null,
  is_sent         boolean not null default false,
  sent_at         timestamptz,
  created_by      bigint references public.members(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists scheduled_notifications_time_idx
  on public.scheduled_notifications (scheduled_at)
  where is_sent = false;

-- ---------------------------------------------------------------------
-- 3. RPC: QUÉT VÀ PHÁT HÀNH THÔNG BÁO ĐẾN HẠN
-- ---------------------------------------------------------------------
create or replace function public.dispatch_scheduled_notifications()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_count int := 0;
  v_target_members bigint[];
begin
  for v_rec in
    select *
    from public.scheduled_notifications
    where is_sent = false
      and scheduled_at <= now()
    for update skip locked
  loop
    v_target_members := '{}';

    if v_rec.recipient_type = 'member' and v_rec.target_id is not null then
      v_target_members := array[v_rec.target_id];
    elsif v_rec.recipient_type = 'unit' and v_rec.target_id is not null then
      select array_agg(id) into v_target_members
      from public.members
      where unit_id = v_rec.target_id and is_active = true;
    else
      select array_agg(id) into v_target_members
      from public.members
      where is_active = true;
    end if;

    if v_target_members is not null and array_length(v_target_members, 1) > 0 then
      insert into public.notifications (recipient_id, type, level, title, body, is_read)
      select m_id, 'reminder', v_rec.level::public.notification_level, v_rec.title, v_rec.content, false
      from unnest(v_target_members) as m_id;
    end if;

    update public.scheduled_notifications
    set is_sent = true,
        sent_at = now()
    where id = v_rec.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.dispatch_scheduled_notifications() from public;
grant execute on function public.dispatch_scheduled_notifications() to authenticated;
grant execute on function public.dispatch_scheduled_notifications() to anon;

-- ---------------------------------------------------------------------
-- 4. RPC: THÔNG BÁO BÍ THƯ CHI ĐOÀN KHI CÓ ĐOÀN VIÊN MỚI ĐĂNG KÝ GOOGLE
-- ---------------------------------------------------------------------
create or replace function public.notify_secretary_new_registration(
  p_member_id bigint,
  p_unit_id bigint,
  p_full_name text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secretary_id bigint;
  v_unit_name text;
begin
  -- Tìm tên chi đoàn
  select name into v_unit_name from public.units where id = p_unit_id;

  -- Tìm bí thư chi đoàn (ưu tiên từ ban chấp hành chi đoàn)
  select member_id into v_secretary_id
  from public.unit_committees
  where unit_id = p_unit_id
    and position in ('secretary', 'deputy_secretary')
    and is_active = true
  order by (case when position = 'secretary' then 1 else 2 end)
  limit 1;

  -- Dự phòng: tìm đoàn viên có chức vụ secretary trong bảng members
  if v_secretary_id is null then
    select id into v_secretary_id
    from public.members
    where unit_id = p_unit_id
      and current_position in ('secretary', 'deputy_secretary')
      and is_active = true
    limit 1;
  end if;

  -- Nếu tìm thấy bí thư chi đoàn, gửi thông báo chuông
  if v_secretary_id is not null then
    insert into public.notifications (
      recipient_id,
      type,
      level,
      title,
      body,
      is_read
    )
    values (
      v_secretary_id,
      'review_request',
      'orange',
      'Đoàn viên mới đăng ký tài khoản',
      'Đồng chí ' || p_full_name || ' vừa đăng ký tài khoản và chọn Chi đoàn ' || coalesce(v_unit_name, '') || '. Vui lòng kiểm tra và xác nhận hồ sơ.',
      false
    );
  end if;

  return true;
end;
$$;

revoke all on function public.notify_secretary_new_registration(bigint, bigint, text) from public;
grant execute on function public.notify_secretary_new_registration(bigint, bigint, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. RPC: KHÔI PHỤC CÀI ĐẶT GỐC / XÓA TOÀN BỘ DỮ LIỆU THỬ NGHIỆM
--    Chỉ Super Admin được gọi. Giữ lại tài khoản Admin hiện tại & danh mục chuẩn.
-- ---------------------------------------------------------------------
create or replace function public.reset_factory_data(p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_current_member_id bigint;
  v_current_profile_id uuid;
  v_tables text[] := array[
    'journal_links','journal_images','journal_entries',
    'evidences','member_submissions','task_results','task_sub_criteria',
    'task_registrations','task_units','tasks',
    'criterion_submissions','sub_criteria','criteria','criteria_sections','criteria_sets',
    'unit_evaluations','member_evaluations','member_disciplines','member_rldv_levels','evaluation_periods',
    'union_fee_payments','unit_fee_distributions',
    'notifications','warnings','reports','scheduled_notifications',
    'unit_committees'
  ];
  v_tbl text;
begin
  -- 1. Xac nhan an toan
  if p_confirmation <> 'XOA TOAN BO DU LIEU' then
    raise exception 'Cum tu xac nhan khong chinh xac. Thao tac bi huy.';
  end if;

  -- 2. Kiem tra quyen
  select r.name into v_caller_role
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();

  if v_caller_role is null or v_caller_role not in ('super_admin','admin') then
    raise exception 'Chi Quan tri vien (Admin/Super Admin) moi co quyen khoi phuc cai dat goc.';
  end if;

  -- 3. Giu lai tai khoan dang dang nhap
  select auth.uid() into v_current_profile_id;
  if v_current_profile_id is not null then
    select member_id into v_current_member_id
    from public.profiles where id = v_current_profile_id;
  end if;

  -- 4. Xoa du lieu: chi voi bang thuc su ton tai
  foreach v_tbl in array v_tables loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format('truncate table public.%I cascade', v_tbl);
    end if;
  end loop;

  -- 5. Xoa tai khoan khac (giu tai khoan hien tai)
  if v_current_profile_id is not null then
    delete from public.profiles where id <> v_current_profile_id;
  end if;

  -- 6. Xoa doan vien khac (giu ho so cua tai khoan hien tai)
  if v_current_member_id is not null then
    delete from public.members where id <> v_current_member_id;
  else
    delete from public.members;
  end if;

  -- 7. Chi xoa chi doan khong con doan vien (giu chi doan cua admin)
  delete from public.units u
  where not exists (select 1 from public.members m where m.unit_id = u.id);

  -- 8. Ghi nhat ky - bo qua neu bang audit_logs co cau truc khac (khong chan reset)
  begin
    insert into public.audit_logs (actor_id, actor_role, action, table_name, row_id, new_value)
    values (
      v_current_profile_id,
      coalesce(v_caller_role, 'admin'),
      'FACTORY_RESET',
      'SYSTEM',
      'ALL',
      '{"message":"Khoi phuc cai dat goc thanh cong"}'::jsonb
    );
  exception when others then
    null;
  end;

  return jsonb_build_object(
    'success', true,
    'message', 'Da don sach toan bo du lieu thu nghiem thanh cong. He thong san sang ban giao.'
  );
end;
$$;

revoke all on function public.reset_factory_data(text) from public;
grant execute on function public.reset_factory_data(text) to authenticated;

-- RLS cho scheduled_notifications
alter table public.scheduled_notifications enable row level security;

drop policy if exists scheduled_notifications_select on public.scheduled_notifications;
create policy scheduled_notifications_select on public.scheduled_notifications
  for select to authenticated using (private.is_admin());

drop policy if exists scheduled_notifications_write on public.scheduled_notifications;
create policy scheduled_notifications_write on public.scheduled_notifications
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
