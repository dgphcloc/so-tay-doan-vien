-- =====================================================================
-- GIAI ĐOẠN 2 · NHIỆM VỤ: tạo bảng task_sub_criteria (bảng nối nhiệm vụ ↔ tiêu chí)
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

create table if not exists public.task_sub_criteria (
  task_id          bigint not null references public.tasks(id) on delete cascade,
  sub_criterion_id bigint not null references public.sub_criteria(id) on delete cascade,
  contribution_score numeric(5,2) not null default 0,
  created_at       timestamptz not null default now(),
  constraint task_sub_criteria_pkey primary key (task_id, sub_criterion_id),
  constraint task_sub_criteria_score_check check (contribution_score >= 0)
);

create index if not exists task_sub_criteria_sub_idx on public.task_sub_criteria (sub_criterion_id);

-- RLS: các bảng giai đoạn 2 khác trong DB không bật RLS, nhưng bật cho bảng mới
-- để nhất quán với quy ước (admin ghi, mọi vai trò đã đăng nhập đọc).
alter table public.task_sub_criteria enable row level security;

drop policy if exists task_sub_criteria_select on public.task_sub_criteria;
create policy task_sub_criteria_select on public.task_sub_criteria
  for select to authenticated
  using (private.my_role() is not null);

drop policy if exists task_sub_criteria_write on public.task_sub_criteria;
create policy task_sub_criteria_write on public.task_sub_criteria
  for all to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- Kiểm tra
select count(*) as so_dong from public.task_sub_criteria;
