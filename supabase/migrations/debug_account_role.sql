-- =====================================================================
-- CHẨN ĐOÁN: Tài khoản đang đăng nhập là ai, quyền gì?
-- Chạy trong Supabase SQL Editor để xem tình trạng thật.
-- Lưu ý: email nằm ở auth.users, KHÔNG phải profiles.email
-- =====================================================================

-- 1. Bảng roles có đủ 5 vai trò chưa?
select id, name from public.roles order by id;

-- 2. Tài khoản tinhocvanphong đang có role gì?
select
  p.id            as profile_id,
  u.email,
  r.name          as role,
  p.member_id,
  m.full_name,
  m.unit_id,
  m.current_position,
  m.is_active
from public.profiles p
join auth.users u on u.id = p.id
left join public.roles r on r.id = p.role_id
left join public.members m on m.id = p.member_id
where u.email ilike '%tinhocvanphong%';

-- 3. Thành viên này có trong Ban Chấp hành không?
select
  c.id,
  c.unit_id,
  c.position,
  c.is_standing,
  c.term_start,
  c.term_end,
  m.full_name
from public.unit_committees c
join public.members m on m.id = c.member_id
where m.full_name ilike '%tinhocvanphong%'
   or m.full_name ilike '%Hồng Thảo%';

-- 4. Tất cả tài khoản + role hiện tại (để đối chiếu)
select
  u.email,
  r.name as role,
  p.member_id,
  m.full_name,
  m.current_position
from public.profiles p
join auth.users u on u.id = p.id
left join public.roles r on r.id = p.role_id
left join public.members m on m.id = p.member_id
order by r.name, u.email;

-- 5. Kiểm tra helper nhận diện bí thư (chạy sau khi đã chạy phase12b)
-- select private.is_unit_secretary() as la_bi_thu, private.my_role() as role;