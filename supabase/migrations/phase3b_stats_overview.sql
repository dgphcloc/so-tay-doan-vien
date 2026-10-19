-- =====================================================================
-- GIAI ĐOẠN 3b · SỐ LIỆU TỔNG HỢP AN TOÀN CHO MỌI VAI TRÒ
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Vì sao cần: bảng `members` có RLS `members_select = is_admin() OR id = my_member_id()`.
-- Đoàn viên chỉ đọc được đúng dòng của mình, nên giao diện đếm `members.length`
-- và ra "1 đoàn viên" thay vì toàn xã. Hàm dưới đây trả SỐ ĐẾM tổng hợp,
-- không trả danh sách, nên không lộ dữ liệu cá nhân.
-- =====================================================================

create or replace function public.stats_overview()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_members',      (select count(*) from public.members where is_active),
    'total_units',        (select count(*) from public.units where is_active),
    'total_units_all',    (select count(*) from public.units),
    'active_members_by_unit', (
      select coalesce(jsonb_object_agg(unit_id::text, cnt), '{}'::jsonb)
      from (
        select unit_id, count(*) as cnt
        from public.members
        where is_active
        group by unit_id
      ) t
    )
  );
$$;

-- Chỉ người đã đăng nhập được gọi; số liệu tổng hợp không phải dữ liệu cá nhân.
revoke all on function public.stats_overview() from public;
grant execute on function public.stats_overview() to authenticated;

-- Kiểm tra
select public.stats_overview() as so_lieu_tong_hop;

-- =====================================================================
-- EMAIL ĐOÀN VIÊN CHO ADMIN
-- Email nằm ở auth.users, không ở public.members. Hàm này chỉ admin gọi được
-- và chỉ trả email + member_id, không trả mật khẩu/hash hay metadata khác.
-- =====================================================================

create or replace function public.member_emails()
returns table (member_id bigint, email text)
language sql
security definer
set search_path = public
as $$
  select p.member_id, u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.member_id is not null
    and private.is_admin()
$$;

revoke all on function public.member_emails() from public;
grant execute on function public.member_emails() to authenticated;

-- Kiểm tra (chạy bằng tài khoản admin sẽ thấy dòng, tài khoản khác sẽ rỗng)
select count(*) as so_email from public.member_emails();

-- =====================================================================
-- DANH SÁCH TÀI KHOẢN KÈM EMAIL (trang Tài khoản & quyền)
-- =====================================================================

create or replace function public.list_profiles_admin()
returns table (id uuid, member_id bigint, role_id smallint, role_name text, is_active boolean, email text)
language sql
security definer
set search_path = public
as $$
  select p.id, p.member_id, p.role_id, r.name::text, p.is_active, u.email::text
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join auth.users u on u.id = p.id
  where private.is_admin()
$$;

revoke all on function public.list_profiles_admin() from public;
grant execute on function public.list_profiles_admin() to authenticated;
