-- =====================================================================
-- GIAI ĐOẠN 3c · LƯU TRỮ / XÓA VĨNH VIỄN BỘ TIÊU CHÍ
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Nguyên tắc:
--   • Bộ đã có bài chấm  -> mặc định LƯU TRỮ (archived_at), ẩn khỏi mọi danh sách,
--     giữ nguyên điểm + minh chứng, khôi phục được.
--   • Xóa vĩnh viễn      -> chỉ admin, có snapshot JSON trong audit_logs trước khi xóa.
-- =====================================================================

-- 1. Cột lưu trữ (soft delete)
alter table public.criteria_sets
  add column if not exists archived_at timestamptz;

create index if not exists criteria_sets_archived_idx on public.criteria_sets (archived_at);

-- 2. Snapshot: bảng nhật ký cần lưu được JSON lớn (không cắt cụt)
--    old_value/new_value là text nên ghi được chuỗi JSON; không cần đổi kiểu.

-- 3. Hàm đếm quy mô ảnh hưởng trước khi xóa (dùng cho modal xác nhận)
create or replace function public.criteria_set_impact(p_set_id bigint)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with subs as (
    select sc.id
    from public.sub_criteria sc
    join public.criteria c on c.id = sc.criterion_id
    join public.criteria_sections s on s.id = c.section_id
    where s.criteria_set_id = p_set_id
  ),
  submissions as (
    select cs.id, cs.sub_criterion_id, cs.unit_id
    from public.criterion_submissions cs
    join subs on subs.id = cs.sub_criterion_id
  )
  select jsonb_build_object(
    'submission_count', (select count(*) from submissions),
    'unit_count',       (select count(distinct unit_id) from submissions),
    'evidence_count',   (select count(*) from public.evidences e
                          where e.submission_id in (select id from submissions)),
    'sub_criteria_count', (select count(*) from subs),
    'is_archived',      (select archived_at is not null from public.criteria_sets where id = p_set_id)
  );
$$;

revoke all on function public.criteria_set_impact(bigint) from public;
grant execute on function public.criteria_set_impact(bigint) to authenticated;

-- 4. Lấy đường dẫn Storage của minh chứng thuộc bộ (để xóa file, tránh mồ côi)
create or replace function public.criteria_set_evidence_paths(p_set_id bigint)
returns table (storage_path text)
language sql
security definer
set search_path = public
as $$
  select e.storage_path
  from public.evidences e
  where e.storage_path is not null
    and e.evidence_type <> 'link'
    and e.submission_id in (
      select cs.id
      from public.criterion_submissions cs
      join public.sub_criteria sc on sc.id = cs.sub_criterion_id
      join public.criteria c on c.id = sc.criterion_id
      join public.criteria_sections s on s.id = c.section_id
      where s.criteria_set_id = p_set_id
    );
$$;

revoke all on function public.criteria_set_evidence_paths(bigint) from public;
grant execute on function public.criteria_set_evidence_paths(bigint) to authenticated;

-- 5. Dọn FK: task_sub_criteria trỏ tới sub_criteria thì phải xóa trước
--    (bảng này không có ON DELETE CASCADE, nên lệnh xóa sẽ lỗi nếu còn tham chiếu)

-- Kiểm tra
select id, name, year, archived_at from public.criteria_sets order by year desc;
