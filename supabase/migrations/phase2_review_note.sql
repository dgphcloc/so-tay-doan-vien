-- =====================================================================
-- GIAI ĐOẠN 2 · BỔ SUNG CỘT review_note CHO criterion_submissions
-- Bảng task_results đã có review_note nhưng criterion_submissions thì chưa,
-- khiến việc nộp lại / duyệt / từ chối bài tiêu chí bị lỗi "column not found".
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

alter table public.criterion_submissions
  add column if not exists review_note text;

comment on column public.criterion_submissions.review_note is 'Ghi chú của người duyệt khi duyệt/từ chối';

-- Kiểm tra
select column_name from information_schema.columns
where table_schema='public' and table_name='criterion_submissions'
order by ordinal_position;
