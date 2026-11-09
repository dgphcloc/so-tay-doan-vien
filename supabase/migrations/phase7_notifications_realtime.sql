-- =====================================================================
-- GIAI ĐOẠN 7 · THÔNG BÁO REALTIME & ĐÁNH DẤU ĐÃ ĐỌC
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

-- 1. Bật Realtime cho bảng notifications
do $$
begin
  -- Bật REPLICA IDENTITY FULL để nhận đầy đủ dữ liệu khi có sự kiện UPDATE
  alter table public.notifications replica identity full;

  -- Thêm vào publication supabase_realtime nếu chưa có
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- 2. Bật Row Level Security (RLS) cho bảng notifications
alter table public.notifications enable row level security;

-- Người dùng chỉ xem được thông báo gửi cho chính mình (hoặc Admin xem được thông báo mình nhận / toàn xã)
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    recipient_id = private.my_member_id()
    or private.is_admin()
  );

-- Chỉ người nhận hoặc Admin mới được đánh dấu đã đọc
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (
    recipient_id = private.my_member_id()
    or private.is_admin()
  )
  with check (
    recipient_id = private.my_member_id()
    or private.is_admin()
  );

-- Cho phép authenticated tạo thông báo (hệ thống gửi nhắc nhở / phát động nhiệm vụ)
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (true);

-- 3. RPC Đánh dấu 1 thông báo là đã đọc
create or replace function public.mark_notification_read(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mid bigint := private.my_member_id();
  v_is_admin boolean := private.is_admin();
begin
  update public.notifications
  set is_read = true,
      read_at = now(),
      updated_at = now()
  where id = p_id
    and (recipient_id = v_mid or v_is_admin);

  return found;
end;
$$;

revoke all on function public.mark_notification_read(bigint) from public;
grant execute on function public.mark_notification_read(bigint) to authenticated;

-- 4. RPC Đánh dấu TẤT CẢ thông báo của người gọi là đã đọc
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mid bigint := private.my_member_id();
  v_count int := 0;
begin
  if v_mid is null then
    return 0;
  end if;

  update public.notifications
  set is_read = true,
      read_at = now(),
      updated_at = now()
  where recipient_id = v_mid
    and is_read = false;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- 5. RPC Lấy danh sách thông báo của người đang đăng nhập
-- Trả về thông báo gửi cho chính mình, sắp xếp mới nhất lên đầu, giới hạn 100 thông báo gần nhất
create or replace function public.my_notifications()
returns setof public.notifications
language sql
security definer
set search_path = public
as $$
  select *
  from public.notifications
  where recipient_id = private.my_member_id()
  order by created_at desc
  limit 100;
$$;

revoke all on function public.my_notifications() from public;
grant execute on function public.my_notifications() to authenticated;

-- Kiểm tra
select count(*) as so_thong_bao_cua_toi from public.my_notifications();
