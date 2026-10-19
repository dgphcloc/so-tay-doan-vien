-- =====================================================================
-- GIAI ĐOẠN 2 · NHIỆM VỤ: thêm người đóng / thời điểm đóng
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

alter table public.tasks
  add column if not exists closed_by bigint references public.members(id) on delete set null,
  add column if not exists closed_at timestamptz;

comment on column public.tasks.closed_by is 'Đoàn viên đóng nhiệm vụ (null nếu chưa đóng)';
comment on column public.tasks.closed_at is 'Thời điểm đóng nhiệm vụ';

-- Kiểm tra
select column_name from information_schema.columns
where table_schema='public' and table_name='tasks'
order by ordinal_position;
