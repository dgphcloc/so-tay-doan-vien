-- =====================================================================
-- GIAI ĐOẠN 9 · THU NỘP, QUẢN LÝ ĐOÀN PHÍ & TÍCH HỢP PAYOS VIETQR
-- Theo Hướng dẫn 39-HD/TWĐTN-BKT ngày 18/3/2024 của Ban Bí thư TW Đoàn.
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại nhiều lần.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. MỞ RỘNG BẢNG MEMBERS: HƯỞNG LƯƠNG, XÉT MIỄN, CHUYỂN SINH HOẠT
-- ---------------------------------------------------------------------
alter table public.members
  add column if not exists has_salary boolean not null default false,
  add column if not exists exempt_months smallint[] not null default '{}',
  add column if not exists transferred_out_month smallint default null;

comment on column public.members.has_salary is 'true: 5.000đ/tháng (có hưởng lương); false: 2.000đ/tháng (không hưởng lương)';
comment on column public.members.exempt_months is 'Mảng các tháng được miễn do hoàn cảnh khó khăn/hộ nghèo (1..12, tối đa 6 tháng/năm)';
comment on column public.members.transferred_out_month is 'Tháng chuyển sinh hoạt Đoàn đi nơi khác trong năm (từ tháng này không tính nợ)';

-- ---------------------------------------------------------------------
-- 2. BẢNG CẤU HÌNH ĐOÀN PHÍ & THANH TOÁN (TẬP TRUNG TOÀN XÃ)
-- ---------------------------------------------------------------------
create table if not exists public.union_fee_settings (
  id                   smallint primary key default 1,
  bank_name            text not null default 'MB Bank',
  bank_code            text not null default '970422', -- Mã BIN MB Bank chuẩn Napas
  account_number       text not null default '0585682707',
  account_holder       text not null default 'DUONG PHUOC LOC',
  auto_remind_day      smallint not null default 5 check (auto_remind_day between 1 and 28),
  fee_non_salary       int not null default 2000,
  fee_has_salary       int not null default 5000,

  -- Tích hợp Cổng PayOS
  payos_client_id      text default '8ee9d939-9f65-4c50-a6bd-d0268ce14dfd',
  payos_api_key        text default '4e07a201-0bab-43ad-89aa-d2bcf6ca9e96',
  payos_checksum_key   text default '5e51534bea3712dc6d4fc59e44418e3172d2a5369675e846c2ced044b2d41363',
  payos_active         boolean not null default true,

  updated_by           bigint references public.members(id) on delete set null,
  updated_at           timestamptz not null default now()
);

-- Khởi tạo dòng cấu hình mặc định duy nhất nếu chưa có
insert into public.union_fee_settings (
  id, bank_name, bank_code, account_number, account_holder,
  auto_remind_day, fee_non_salary, fee_has_salary,
  payos_client_id, payos_api_key, payos_checksum_key, payos_active
)
values (
  1, 'MB Bank', '970422', '0585682707', 'DUONG PHUOC LOC',
  5, 2000, 5000,
  '8ee9d939-9f65-4c50-a6bd-d0268ce14dfd',
  '4e07a201-0bab-43ad-89aa-d2bcf6ca9e96',
  '5e51534bea3712dc6d4fc59e44418e3172d2a5369675e846c2ced044b2d41363',
  true
)
on conflict (id) do update set
  bank_name = excluded.bank_name,
  bank_code = excluded.bank_code,
  account_number = excluded.account_number,
  account_holder = excluded.account_holder,
  payos_client_id = excluded.payos_client_id,
  payos_api_key = excluded.payos_api_key,
  payos_checksum_key = excluded.payos_checksum_key,
  payos_active = excluded.payos_active;

-- ---------------------------------------------------------------------
-- 3. BẢNG GHI NHẬN CÁC ĐỢT NỘP ĐOÀN PHÍ
-- ---------------------------------------------------------------------
create table if not exists public.union_fee_payments (
  id              bigserial primary key,
  member_id       bigint not null references public.members(id) on delete cascade,
  unit_id         bigint not null references public.units(id) on delete cascade,
  year            smallint not null,
  months          smallint[] not null, -- Mảng các tháng nộp: ví dụ {1,2,3} hoặc {1,2,3,4,5,6,7,8,9,10,11,12}
  amount          int not null check (amount > 0),
  -- 'payos' (chuyển khoản VietQR payOS tự động) | 'bank_transfer' (chuyển khoản tay) | 'cash' (tiền mặt)
  payment_method  text not null default 'payos' check (payment_method in ('payos', 'bank_transfer', 'cash')),
  -- 'pending' (chờ duyệt) | 'approved' (đã thu) | 'rejected' (từ chối)
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  order_code      bigint unique, -- Mã đơn hàng PayOS dùng đối soát tự động
  evidence_url    text,          -- Ảnh chụp biên lai / bill chuyển khoản nếu có
  note            text,
  reviewed_by     bigint references public.members(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists union_fee_payments_member_idx on public.union_fee_payments (member_id, year);
create index if not exists union_fee_payments_unit_idx on public.union_fee_payments (unit_id, year);
create index if not exists union_fee_payments_order_idx on public.union_fee_payments (order_code);

-- ---------------------------------------------------------------------
-- 4. BẢNG THEO DÕI TRÍCH NỘP 2/3 - 1/3 (HOÀN TRẢ KINH PHÍ CHO CHI ĐOÀN)
-- ---------------------------------------------------------------------
create table if not exists public.unit_fee_distributions (
  id              bigserial primary key,
  unit_id         bigint not null references public.units(id) on delete cascade,
  year            smallint not null,
  period_label    text not null default 'Cả năm', -- 'Quý 1', '6 tháng đầu năm', 'Cả năm'...
  total_collected int not null default 0,         -- Tổng số đoàn phí thu được của chi đoàn
  unit_share      int not null default 0,         -- 2/3 chi đoàn được giữ lại sử dụng
  commune_share   int not null default 0,         -- 1/3 xã giữ lại trích nộp cấp trên và sử dụng
  is_refunded     boolean not null default false, -- Xã đã trích hoàn trả 2/3 lại cho chi đoàn chưa
  refunded_at     date,
  refunded_by     bigint references public.members(id) on delete set null,
  receipt_no      text,                           -- Số phiếu chi / biên nhận hoàn tiền
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (unit_id, year, period_label)
);

-- ---------------------------------------------------------------------
-- 5. RLS (ROW LEVEL SECURITY)
-- ---------------------------------------------------------------------
alter table public.union_fee_settings enable row level security;
alter table public.union_fee_payments enable row level security;
alter table public.unit_fee_distributions enable row level security;

-- Settings: Ai cũng đọc được để quét QR, chỉ Admin sửa
drop policy if exists union_fee_settings_select on public.union_fee_settings;
create policy union_fee_settings_select on public.union_fee_settings
  for select to authenticated using (true);

drop policy if exists union_fee_settings_write on public.union_fee_settings;
create policy union_fee_settings_write on public.union_fee_settings
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Payments:
-- Đoàn viên xem của mình; Bí thư chi đoàn xem của chi đoàn mình; Admin xem toàn xã
drop policy if exists union_fee_payments_select on public.union_fee_payments;
create policy union_fee_payments_select on public.union_fee_payments
  for select to authenticated
  using (
    private.is_admin()
    or member_id = private.my_member_id()
    or unit_id = private.my_unit_id()
  );

-- Đoàn viên tạo yêu cầu nộp của mình; Bí thư chi đoàn tạo phiếu thu tiền mặt
drop policy if exists union_fee_payments_insert on public.union_fee_payments;
create policy union_fee_payments_insert on public.union_fee_payments
  for insert to authenticated
  with check (
    private.is_admin()
    or member_id = private.my_member_id()
    or unit_id = private.my_unit_id()
  );

-- Duyệt thanh toán: Bí thư chi đoàn hoặc Admin
drop policy if exists union_fee_payments_update on public.union_fee_payments;
create policy union_fee_payments_update on public.union_fee_payments
  for update to authenticated
  using (
    private.is_admin()
    or unit_id = private.my_unit_id()
  )
  with check (
    private.is_admin()
    or unit_id = private.my_unit_id()
  );

-- Distributions: Bí thư chi đoàn xem chi đoàn mình; Admin xem toàn xã và quản lý
drop policy if exists unit_fee_distributions_select on public.unit_fee_distributions;
create policy unit_fee_distributions_select on public.unit_fee_distributions
  for select to authenticated
  using (
    private.is_admin()
    or unit_id = private.my_unit_id()
  );

drop policy if exists unit_fee_distributions_write on public.unit_fee_distributions;
create policy unit_fee_distributions_write on public.unit_fee_distributions
  for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------
-- 6. RPC: GẠCH NỢ TỰ ĐỘNG KHI PAYOS BÁO TIỀN VỀ (WEBHOOK)
-- ---------------------------------------------------------------------
create or replace function public.payos_confirm_payment(
  p_order_code bigint,
  p_amount int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.union_fee_payments;
begin
  select * into v_payment
  from public.union_fee_payments
  where order_code = p_order_code;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Khong tim thay don hang order_code ' || p_order_code);
  end if;

  if v_payment.status = 'approved' then
    return jsonb_build_object('success', true, 'message', 'Don hang da duoc xac nhan truoc do');
  end if;

  update public.union_fee_payments
  set status = 'approved',
      reviewed_at = now(),
      updated_at = now(),
      note = coalesce(note, '') || ' [Xac nhan tu dong qua payOS]'
  where id = v_payment.id;

  -- Bắn 1 thông báo chuông cho đoàn viên biết đã thanh toán thành công
  insert into public.notifications (
    recipient_id,
    type,
    level,
    title,
    body,
    is_read
  )
  values (
    v_payment.member_id,
    'system',
    'yellow',
    'Thanh toán đoàn phí thành công',
    'Hệ thống đã nhận được ' || to_char(p_amount, 'FM999,999,999') || 'đ đoàn phí năm ' || v_payment.year || ' của bạn qua payOS. Cảm ơn đồng chí!',
    false
  );

  return jsonb_build_object('success', true, 'payment_id', v_payment.id);
end;
$$;

revoke all on function public.payos_confirm_payment(bigint, int) from public;
grant execute on function public.payos_confirm_payment(bigint, int) to authenticated;
grant execute on function public.payos_confirm_payment(bigint, int) to anon;

-- Kiểm tra bảng
select 'union_fee_settings' as bang, count(*) from public.union_fee_settings
union all select 'union_fee_payments', count(*) from public.union_fee_payments
union all select 'unit_fee_distributions', count(*) from public.unit_fee_distributions;
