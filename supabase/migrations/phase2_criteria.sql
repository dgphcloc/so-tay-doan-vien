-- =====================================================================
-- GIAI ĐOẠN 2 · TIÊU CHÍ: bổ sung cột phân công nhiều chi đoàn
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- =====================================================================

-- 1. Cho phép "áp dụng cho mọi loại chi đoàn" (unit_type_id = NULL).
--    Trước đây NOT NULL nên không biểu diễn được "tất cả loại".
alter table public.sub_criteria alter column unit_type_id drop not null;

-- 2. Thêm cột mảng phân công nhiều loại / nhiều chi đoàn cụ thể.
--    Rỗng = mọi loại / mọi chi đoàn (quy ước ở tầng ứng dụng).
alter table public.sub_criteria
  add column if not exists unit_type_ids smallint[] not null default '{}',
  add column if not exists unit_ids      bigint[]   not null default '{}';

comment on column public.sub_criteria.unit_type_ids is 'Các loại chi đoàn áp dụng (rỗng = mọi loại). Thay cho unit_type_id đơn.';
comment on column public.sub_criteria.unit_ids is 'Các chi đoàn cụ thể áp dụng (rỗng = mọi chi đoàn trong phạm vi loại).';

-- 3. Đồng bộ dữ liệu cũ: nếu unit_type_id đang có thì đưa vào mảng.
update public.sub_criteria
set unit_type_ids = array[unit_type_id]
where unit_type_id is not null
  and (unit_type_ids is null or unit_type_ids = '{}');

update public.sub_criteria
set unit_ids = array[unit_id]
where unit_id is not null
  and (unit_ids is null or unit_ids = '{}');

-- 4. Kiểm tra kết quả
select
  count(*) as tong_tieu_chi_con,
  count(*) filter (where unit_type_id is null) as khong_gioi_han_loai,
  count(*) filter (where array_length(unit_type_ids,1) > 0) as co_gioi_han_loai,
  count(*) filter (where array_length(unit_ids,1) > 0) as giao_chi_doan_cu_the
from public.sub_criteria;
