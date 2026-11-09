-- =====================================================================
-- GIAI ĐOẠN 8 · ĐÁNH GIÁ, XẾP LOẠI ĐOÀN VIÊN HẰNG NĂM
-- Theo Hướng dẫn 25-HD/TWĐTN-BTC ngày 13/9/2023.
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KỲ ĐÁNH GIÁ
--    Mỗi năm một kỳ. Chi đoàn trường học dùng năm học (01/6 -> 31/5).
-- ---------------------------------------------------------------------
create table if not exists public.evaluation_periods (
  id            bigserial primary key,
  year          smallint not null,
  name          text     not null,
  -- 'calendar' = năm dương lịch 01/01..31/12; 'school_year' = 01/6..31/5 năm sau
  period_type   text     not null default 'calendar'
                check (period_type in ('calendar','school_year')),
  start_date    date     not null,
  end_date      date     not null,
  -- 'draft' (chưa mở) | 'open' (đang đánh giá) | 'closed' (đã chốt)
  status        text     not null default 'draft'
                check (status in ('draft','open','closed')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (year, period_type)
);

-- ---------------------------------------------------------------------
-- 2. MỨC CHƯƠNG TRÌNH RÈN LUYỆN ĐOÀN VIÊN THEO NĂM
-- ---------------------------------------------------------------------
create table if not exists public.member_rldv_levels (
  id           bigserial primary key,
  member_id    bigint not null references public.members(id) on delete cascade,
  year         smallint not null,
  -- 'excellent' | 'good' | 'pass' | 'fail'
  level        text not null check (level in ('excellent','good','pass','fail')),
  note         text,
  evaluated_at date,
  evaluated_by bigint references public.members(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (member_id, year)
);

-- ---------------------------------------------------------------------
-- 3. KỶ LUẬT ĐOÀN VIÊN
--    Chỉ Bí thư xã / admin ghi nhận (chặn ở RLS).
-- ---------------------------------------------------------------------
create table if not exists public.member_disciplines (
  id             bigserial primary key,
  member_id      bigint not null references public.members(id) on delete cascade,
  decision_no    text not null,
  -- 'reprimand' (khiển trách) | 'warning' (cảnh cáo) | 'dismissal' (cách chức) | 'expulsion' (khai trừ)
  form           text not null
                 check (form in ('reprimand','warning','dismissal','expulsion')),
  decided_at     date not null,
  effective_from date,
  effective_to   date,
  reason         text,
  created_by     bigint references public.members(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists member_disciplines_member_idx
  on public.member_disciplines (member_id, decided_at desc);

-- ---------------------------------------------------------------------
-- 4. PHIẾU ĐÁNH GIÁ ĐOÀN VIÊN
-- ---------------------------------------------------------------------
create table if not exists public.member_evaluations (
  id            bigserial primary key,
  period_id     bigint not null references public.evaluation_periods(id) on delete cascade,
  member_id     bigint not null references public.members(id) on delete cascade,
  unit_id       bigint not null references public.units(id) on delete cascade,

  -- Số liệu máy tự tính tại thời điểm sinh phiếu
  total_tasks        int     not null default 0,
  completed_tasks    int     not null default 0,
  participation_rate numeric(5,2) not null default 0,
  -- Đảng viên đang sinh hoạt Đoàn: không xếp loại, chỉ đánh giá RLĐV
  is_party_member_block boolean not null default false,
  -- Nghỉ >= 3 tháng: tối đa "Hoàn thành"
  is_long_absent        boolean not null default false,

  auto_rating   text not null default 'not_rated'
                check (auto_rating in ('excellent','good','pass','fail','not_rated')),

  -- Bước 1: đoàn viên tự xác nhận
  member_response      text check (member_response in ('confirmed','disagreed')),
  member_feedback      text,
  member_responded_at  timestamptz,

  -- Bước 2: bí thư chi đoàn duyệt / sửa mức
  secretary_rating     text check (secretary_rating in ('excellent','good','pass','fail','not_rated')),
  secretary_note       text,
  secretary_id         bigint references public.members(id) on delete set null,
  secretary_at         timestamptz,

  -- Bước 3: bí thư xã chốt
  admin_rating   text check (admin_rating in ('excellent','good','pass','fail','not_rated')),
  admin_note     text,
  admin_id       bigint references public.members(id) on delete set null,
  admin_at       timestamptz,

  -- 'auto' -> 'member_responded' -> 'secretary_done' -> 'finalized'
  status  text not null default 'auto'
          check (status in ('auto','member_responded','secretary_done','finalized')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, member_id)
);

create index if not exists member_evaluations_period_idx
  on public.member_evaluations (period_id, unit_id);
create index if not exists member_evaluations_member_idx
  on public.member_evaluations (member_id, period_id);

-- ---------------------------------------------------------------------
-- 5. PHIẾU ĐÁNH GIÁ CHI ĐOÀN
-- ---------------------------------------------------------------------
create table if not exists public.unit_evaluations (
  id        bigserial primary key,
  period_id bigint not null references public.evaluation_periods(id) on delete cascade,
  unit_id   bigint not null references public.units(id) on delete cascade,

  -- Máy tự tính
  task_completion_rate numeric(5,2) not null default 0,
  member_good_rate     numeric(5,2) not null default 0,
  member_fail_count    int not null default 0,
  member_total         int not null default 0,
  digital_rate         numeric(5,2) not null default 0,

  -- Bí thư xã nhập tay
  meeting_ok     boolean not null default false,
  fee_ok         boolean not null default false,
  has_discipline boolean not null default false,

  auto_rating  text not null default 'not_rated'
               check (auto_rating in ('excellent','good','pass','fail','not_rated')),
  final_rating text check (final_rating in ('excellent','good','pass','fail','not_rated')),
  note         text,
  rated_by     bigint references public.members(id) on delete set null,
  rated_at     timestamptz,

  status text not null default 'auto'
         check (status in ('auto','finalized')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, unit_id)
);

-- ---------------------------------------------------------------------
-- 6. KHÓA KẾT QUẢ SAU KHI CHỐT
--    Đã chốt thì mọi thay đổi phải "hủy chốt" trước.
-- ---------------------------------------------------------------------
create or replace function public.tg_block_finalized_evaluation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'finalized' then
    raise exception 'Phieu da chot, khong the sua. Hay huy chot truoc.';
  end if;
  if tg_op = 'DELETE' and old.status = 'finalized' then
    raise exception 'Phieu da chot, khong the xoa. Hay huy chot truoc.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists member_evaluations_lock on public.member_evaluations;
create trigger member_evaluations_lock
  before update or delete on public.member_evaluations
  for each row execute function public.tg_block_finalized_evaluation();

drop trigger if exists unit_evaluations_lock on public.unit_evaluations;
create trigger unit_evaluations_lock
  before update or delete on public.unit_evaluations
  for each row execute function public.tg_block_finalized_evaluation();

-- ---------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------
alter table public.evaluation_periods    enable row level security;
alter table public.member_rldv_levels    enable row level security;
alter table public.member_disciplines    enable row level security;
alter table public.member_evaluations    enable row level security;
alter table public.unit_evaluations      enable row level security;

-- Kỳ đánh giá: ai cũng đọc; admin ghi
drop policy if exists evaluation_periods_select on public.evaluation_periods;
create policy evaluation_periods_select on public.evaluation_periods
  for select to authenticated using (true);

drop policy if exists evaluation_periods_write on public.evaluation_periods;
create policy evaluation_periods_write on public.evaluation_periods
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Mức RLĐV: đọc theo phạm vi của mình; ghi: admin hoặc bí thư chi đoàn của đoàn viên đó
drop policy if exists member_rldv_select on public.member_rldv_levels;
create policy member_rldv_select on public.member_rldv_levels
  for select to authenticated
  using (
    private.is_admin()
    or member_id = private.my_member_id()
    or exists (
      select 1 from public.members m
      where m.id = member_rldv_levels.member_id
        and m.unit_id = private.my_unit_id()
    )
  );

drop policy if exists member_rldv_write on public.member_rldv_levels;
create policy member_rldv_write on public.member_rldv_levels
  for all to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.members m, public.profiles p
      where m.id = member_rldv_levels.member_id
        and p.member_id = private.my_member_id()
        and m.unit_id = private.my_unit_id()
        and p.role_id in (select id from public.roles where name = 'unit_secretary')
    )
  )
  with check (
    private.is_admin()
    or exists (
      select 1 from public.members m, public.profiles p
      where m.id = member_rldv_levels.member_id
        and p.member_id = private.my_member_id()
        and m.unit_id = private.my_unit_id()
        and p.role_id in (select id from public.roles where name = 'unit_secretary')
    )
  );

-- Kỷ luật: chỉ admin đọc/ghi; đoàn viên đọc được của chính mình
drop policy if exists member_disciplines_select on public.member_disciplines;
create policy member_disciplines_select on public.member_disciplines
  for select to authenticated
  using (private.is_admin() or member_id = private.my_member_id());

drop policy if exists member_disciplines_write on public.member_disciplines;
create policy member_disciplines_write on public.member_disciplines
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Phiếu đoàn viên: đoàn viên xem của mình; bí thư chi đoàn xem chi đoàn mình; admin tất cả
drop policy if exists member_evaluations_select on public.member_evaluations;
create policy member_evaluations_select on public.member_evaluations
  for select to authenticated
  using (
    private.is_admin()
    or member_id = private.my_member_id()
    or unit_id = private.my_unit_id()
  );

drop policy if exists member_evaluations_insert on public.member_evaluations;
create policy member_evaluations_insert on public.member_evaluations
  for insert to authenticated
  with check (private.is_admin() or unit_id = private.my_unit_id());

drop policy if exists member_evaluations_update on public.member_evaluations;
create policy member_evaluations_update on public.member_evaluations
  for update to authenticated
  using (private.is_admin() or unit_id = private.my_unit_id())
  with check (private.is_admin() or unit_id = private.my_unit_id());

-- Phiếu chi đoàn: bí thư chi đoàn xem chi đoàn mình; admin tất cả; đoàn viên không xem
drop policy if exists unit_evaluations_select on public.unit_evaluations;
create policy unit_evaluations_select on public.unit_evaluations
  for select to authenticated
  using (private.is_admin() or unit_id = private.my_unit_id());

drop policy if exists unit_evaluations_write on public.unit_evaluations;
create policy unit_evaluations_write on public.unit_evaluations
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------
-- 8. HÀM TIỆN ÍCH
-- ---------------------------------------------------------------------
-- Tạo/cập nhật kỳ đánh giá (tự tính ngày bắt đầu/kết thúc theo loại kỳ)
create or replace function public.evaluation_upsert_period(
  p_year smallint,
  p_period_type text,
  p_name text
)
returns public.evaluation_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
  v_row public.evaluation_periods;
begin
  if not private.is_admin() then
    raise exception 'Chi quan tri vien duoc tao ky danh gia';
  end if;

  if p_period_type = 'school_year' then
    v_start := make_date(p_year, 6, 1);
    v_end   := make_date(p_year + 1, 5, 31);
  else
    v_start := make_date(p_year, 1, 1);
    v_end   := make_date(p_year, 12, 31);
  end if;

  insert into public.evaluation_periods (year, name, period_type, start_date, end_date)
  values (p_year, p_name, p_period_type, v_start, v_end)
  on conflict (year, period_type) do update
    set name = excluded.name,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.evaluation_upsert_period(smallint, text, text) from public;
grant execute on function public.evaluation_upsert_period(smallint, text, text) to authenticated;

-- Đặt lại trạng thái kỳ (draft / open / closed). Mở lại = hủy chốt toàn kỳ.
create or replace function public.evaluation_set_period_status(
  p_period_id bigint,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_admin() then
    raise exception 'Chi quan tri vien duoc doi trang thai ky danh gia';
  end if;

  if p_status not in ('draft','open','closed') then
    raise exception 'Trang thai khong hop le: %', p_status;
  end if;

  -- Hủy chốt: đưa các phiếu đã finalized về secretary_done để sửa lại
  if p_status = 'open' then
    update public.member_evaluations
      set status = 'secretary_done', admin_rating = null, admin_note = null,
          admin_id = null, admin_at = null, updated_at = now()
      where period_id = p_period_id and status = 'finalized';
    update public.unit_evaluations
      set status = 'auto', final_rating = null, rated_by = null, rated_at = null, updated_at = now()
      where period_id = p_period_id and status = 'finalized';
  end if;

  update public.evaluation_periods
    set status = p_status, updated_at = now()
    where id = p_period_id;

  return found;
end;
$$;

revoke all on function public.evaluation_set_period_status(bigint, text) from public;
grant execute on function public.evaluation_set_period_status(bigint, text) to authenticated;

-- Kiểm tra
select 'evaluation_periods' as bang, count(*) from public.evaluation_periods
union all select 'member_evaluations', count(*) from public.member_evaluations
union all select 'unit_evaluations', count(*) from public.unit_evaluations
union all select 'member_disciplines', count(*) from public.member_disciplines
union all select 'member_rldv_levels', count(*) from public.member_rldv_levels;
