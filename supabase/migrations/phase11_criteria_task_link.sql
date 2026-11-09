-- =====================================================================
-- GIAI ĐOẠN 11 · LIÊN KẾT TIÊU CHÍ → NHIỆM VỤ → DUYỆT 2 CẤP → BÁO CÁO
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. NHIỆM VỤ GẮN VỚI 1 TIÊU CHÍ NGUỒN (quan hệ 1-1)
-- ---------------------------------------------------------------------
alter table public.tasks
  add column if not exists source_sub_criterion_id bigint
    references public.sub_criteria(id) on delete set null;

-- Ghi chú: KHÔNG đặt UNIQUE vì một tiêu chí có thể có nhiều nhiệm vụ
-- (VD chi đoàn tạo 2 nhiệm vụ để hoàn thành 1 KPI lớn).

create index if not exists tasks_source_sub_criterion_idx
  on public.tasks (source_sub_criterion_id)
  where source_sub_criterion_id is not null;

-- ---------------------------------------------------------------------
-- 2. DUYỆT 2 CẤP: Bí thư chi đoàn duyệt xong thì Bí thư xã duyệt chốt
-- ---------------------------------------------------------------------
alter table public.task_results
  add column if not exists admin_reviewed_by bigint
    references public.members(id) on delete set null,
  add column if not exists admin_reviewed_at timestamptz;

comment on column public.task_results.admin_reviewed_by is
  'Bí thư xã duyệt lần 2. NULL = chưa duyệt cấp xã (dù bí thư chi đoàn đã duyệt).';

create index if not exists task_results_admin_pending_idx
  on public.task_results (status, admin_reviewed_at)
  where admin_reviewed_at is null;

-- ---------------------------------------------------------------------
-- 3. RPC: DUYỆT HÀNG LOẠT (dùng cho nút "Duyệt tất cả")
-- ---------------------------------------------------------------------
create or replace function public.bulk_approve_task_results(
  p_ids bigint[],
  p_note text default 'Đạt yêu cầu'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reviewer bigint := private.my_member_id();
  v_role text;
  v_count int := 0;
begin
  select name into v_role
  from public.roles r
  join public.profiles p on p.role_id = r.id
  where p.id = auth.uid();

  if v_role is null then
    raise exception 'Khong xac dinh duoc vai tro nguoi dung';
  end if;

  if v_role in ('admin', 'super_admin') then
    update public.task_results
    set status = 'approved',
        admin_reviewed_by = v_reviewer,
        admin_reviewed_at = now(),
        reviewed_by = coalesce(reviewed_by, v_reviewer),
        reviewed_at = coalesce(reviewed_at, now()),
        review_note = coalesce(review_note, p_note)
    where id = any(p_ids) and status = 'pending';
  else
    -- Bí thư chi đoàn: duyệt bài của chi đoàn mình, chỉ nhiệm vụ do mình giao
    update public.task_results tr
    set status = 'approved',
        reviewed_by = v_reviewer,
        reviewed_at = now(),
        review_note = coalesce(tr.review_note, p_note)
    where tr.id = any(p_ids)
      and tr.status = 'pending'
      and tr.unit_id = private.my_unit_id()
      and exists (
        select 1 from public.tasks t
        where t.id = tr.task_id and t.assigned_by = v_reviewer
      );
  end if;

  get diagnostics v_count = row_count;
  return jsonb_build_object('success', true, 'approved', v_count);
end;
$$;

revoke all on function public.bulk_approve_task_results(bigint[], text) from public;
grant execute on function public.bulk_approve_task_results(bigint[], text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPC: TIẾN ĐỘ CÁC TIÊU CHÍ ĐƯỢC GIAO CHO 1 CHI ĐOÀN
--    Dùng cho khối "KPI Đoàn xã giao" ở trang Nộp cá nhân của Bí thư.
-- ---------------------------------------------------------------------
create or replace function public.unit_criterion_progress(p_unit_id bigint)
returns table (
  sub_criterion_id bigint,
  criterion_name   text,
  sub_name         text,
  max_score        numeric,
  total_tasks      int,
  done_tasks       int,
  pending_tasks    int
)
language sql
security definer
set search_path = public
as $$
  with assigned as (
    select sc.id, c.name as criterion_name, sc.condition_text as sub_name, sc.max_score
    from public.sub_criteria sc
    join public.criteria c on c.id = sc.criterion_id
    where (
      sc.unit_ids is not null and p_unit_id = any(sc.unit_ids)
    ) or (
      (sc.unit_ids is null or cardinality(sc.unit_ids) = 0)
      and (
        (sc.unit_type_ids is null or cardinality(sc.unit_type_ids) = 0)
        or exists (
          select 1 from public.units u
          where u.id = p_unit_id and u.unit_type_id = any(sc.unit_type_ids)
        )
      )
    )
  )
  select
    a.id,
    a.criterion_name,
    a.sub_name,
    a.max_score,
    coalesce(t.total, 0)::int,
    coalesce(t.done, 0)::int,
    coalesce(t.pending, 0)::int
  from assigned a
  left join (
    select
      t.source_sub_criterion_id as sc_id,
      count(*) filter (where t.status <> 'draft') as total,
      count(r.id) filter (where r.status = 'approved') as done,
      count(r.id) filter (where r.status = 'pending') as pending
    from public.tasks t
    left join public.task_results r on r.task_id = t.id and r.unit_id = p_unit_id
    where t.source_sub_criterion_id is not null
    group by t.source_sub_criterion_id
  ) t on t.sc_id = a.id;
$$;

revoke all on function public.unit_criterion_progress(bigint) from public;
grant execute on function public.unit_criterion_progress(bigint) to authenticated;

-- Kiểm tra
select 'tasks.source_sub_criterion_id' as col, count(*) as da_gan
from public.tasks where source_sub_criterion_id is not null;