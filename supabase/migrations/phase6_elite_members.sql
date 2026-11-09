-- =====================================================================
-- GIAI ĐOẠN 6 · ĐOÀN VIÊN ƯU TÚ & PHÁT TRIỂN ĐẢNG
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

-- 1. Bổ sung các cột theo dõi Đoàn viên ưu tú & Phát triển Đảng vào bảng members
alter table public.members
  add column if not exists is_elite_member boolean not null default false,
  add column if not exists elite_date date,
  add column if not exists party_target_status text not null default 'none';

alter table public.members
  drop constraint if exists members_party_target_status_check;

alter table public.members
  add constraint members_party_target_status_check
  check (party_target_status in ('none', 'elite', 'trained_class', 'introduced', 'admitted'));

create index if not exists members_elite_idx on public.members (is_elite_member);
create index if not exists members_party_target_status_idx on public.members (party_target_status);

-- 2. Tự động đồng bộ: Nếu is_party_member = true -> party_target_status = 'admitted'
update public.members
set party_target_status = 'admitted', is_elite_member = true
where is_party_member = true and party_target_status = 'none';

-- 3. Xoá view cũ rồi tạo lại mới để tránh lỗi đổi thứ tự/tên cột (ERROR 42P16)
drop view if exists public.members_limited cascade;

create view public.members_limited as
select
  id,
  full_name,
  birth_date,
  gender,
  joined_date,
  unit_id,
  current_position,
  planned_position,
  education_grade,
  specialization,
  political_theory_level,
  is_active,
  avatar_url,
  current_job,
  central_member_code,
  note,
  created_at,
  updated_at,
  is_elite_member,
  elite_date,
  party_target_status
from public.members;

-- Cấp quyền đọc view cho authenticated users
grant select on public.members_limited to authenticated;

-- 4. Kiểm tra số liệu
select count(*) as tong_doan_vien,
       count(*) filter (where is_elite_member) as so_doan_vien_uu_tu,
       count(*) filter (where is_party_member) as so_dang_vien
from public.members;
