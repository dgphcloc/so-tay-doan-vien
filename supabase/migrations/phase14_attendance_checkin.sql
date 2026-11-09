-- =====================================================================
-- GIAI ĐOẠN 14 · KIỂM TRA VỊ TRÍ KHI NỘP MINH CHỨNG ("CHECK-IN ĐIỂM DANH")
--
-- Bối cảnh nghiệp vụ:
--   "Sự kiện" trong dự án này CHÍNH LÀ nhiệm vụ (tasks) — không có bảng events.
--   Khi đoàn viên nộp ảnh minh chứng, mỗi ảnh mang toạ độ GPS riêng. Hệ thống
--   so toạ độ đó với điểm tổ chức của nhiệm vụ và gắn nhãn để cán bộ cân nhắc
--   khi duyệt. KHÔNG có bảng check-in riêng, KHÔNG có trang check-in riêng.
--
-- Quy tắc đã chốt:
--   1. Trình duyệt chỉ gửi lat/lng/accuracy. Khoảng cách tính TRONG DATABASE
--      bằng Haversine, gọi qua trigger. Client không ghi đè được kết quả.
--   2. Nhiều ảnh: MỘT ảnh trong phạm vi là đạt (lấy khoảng cách nhỏ nhất).
--   3. Chỉ kiểm tra khi nhiệm vụ có toạ độ. Nhiệm vụ không toạ độ -> bỏ qua.
--   4. Bán kính 2 tầng: yearly_settings (toàn hệ thống) < tasks.radius_m (ghi đè).
--      Mỗi lượt nộp LƯU bán kính đã áp dụng để sửa sau không đổi kết quả cũ.
--   5. Ngoài khung giờ điểm danh: VẪN CHO NỘP, chỉ gắn cờ "ngoài giờ".
--   6. Nhập tay / dán link Maps: vẫn tính bình thường nhưng ghi nguồn toạ độ
--      để cán bộ thấy nhãn "Không xác thực".
--   7. KHÔNG backfill dữ liệu cũ — bài nộp trước migration để trống nhãn.
--
-- Chạy trên Supabase SQL Editor. An toàn khi chạy lại (idempotent).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. CẤU HÌNH CHUNG (tầng 1) — yearly_settings
-- ---------------------------------------------------------------------
alter table public.yearly_settings
  add column if not exists default_radius_m numeric(6,1) not null default 100;
alter table public.yearly_settings
  add column if not exists max_accuracy_m   numeric(6,1) not null default 100;

-- Ràng buộc miền giá trị. Dùng DO block vì table đã tồn tại, constraint có thể có sẵn.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'yearly_settings_radius_range'
  ) then
    alter table public.yearly_settings
      add constraint yearly_settings_radius_range
      check (default_radius_m >= 20 and default_radius_m <= 1000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'yearly_settings_accuracy_range'
  ) then
    alter table public.yearly_settings
      add constraint yearly_settings_accuracy_range
      check (max_accuracy_m >= 5 and max_accuracy_m <= 500);
  end if;
end $$;

comment on column public.yearly_settings.default_radius_m is
  'Bán kính điểm danh mặc định toàn hệ thống (mét). 20..1000.';
comment on column public.yearly_settings.max_accuracy_m is
  'Sai số GPS tối đa chấp nhận (mét). Vượt ngưỡng -> nhãn "Độ chính xác kém". 5..500.';

-- ---------------------------------------------------------------------
-- 2. NHIỆM VỤ — toạ độ điểm tổ chức đã có (tasks.lat/lng), thêm phần còn thiếu
-- ---------------------------------------------------------------------
alter table public.tasks
  add column if not exists radius_m numeric(6,1);
alter table public.tasks
  add column if not exists attendance_open_at  timestamptz;
alter table public.tasks
  add column if not exists attendance_close_at timestamptz;

do $$
begin
  -- Bán kính riêng của nhiệm vụ (trống = dùng mặc định toàn hệ thống)
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_radius_range'
  ) then
    alter table public.tasks
      add constraint tasks_radius_range
      check (radius_m is null or (radius_m >= 20 and radius_m <= 1000));
  end if;

  -- Toạ độ phải nằm trong miền hợp lệ (nếu có)
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_lat_lng_range'
  ) then
    alter table public.tasks
      add constraint tasks_lat_lng_range
      check (
        (lat is null or (lat >= -90 and lat <= 90))
        and (lng is null or (lng >= -180 and lng <= 180))
      );
  end if;

  -- Khung giờ điểm danh phải hợp lệ
  if not exists (
    select 1 from pg_constraint where conname = 'tasks_attendance_window_order'
  ) then
    alter table public.tasks
      add constraint tasks_attendance_window_order
      check (
        attendance_open_at is null
        or attendance_close_at is null
        or attendance_open_at <= attendance_close_at
      );
  end if;
end $$;

comment on column public.tasks.radius_m is
  'Bán kính điểm danh riêng của nhiệm vụ (mét). Trống = dùng yearly_settings.default_radius_m.';
comment on column public.tasks.attendance_open_at is
  'Giờ mở điểm danh. Trống = không giới hạn riêng, chỉ dùng due_date.';
comment on column public.tasks.attendance_close_at is
  'Giờ đóng điểm danh. Trống = không giới hạn riêng.';

-- ---------------------------------------------------------------------
-- 3. BÀI NỘP CÁ NHÂN — lưu kết quả check-in
-- ---------------------------------------------------------------------
alter table public.member_submissions
  add column if not exists accuracy_m          numeric(6,1);
alter table public.member_submissions
  add column if not exists distance_m          numeric(8,1);
alter table public.member_submissions
  add column if not exists radius_applied_m    numeric(6,1);
alter table public.member_submissions
  add column if not exists checkin_result      text;
alter table public.member_submissions
  add column if not exists coord_source        text;
alter table public.member_submissions
  add column if not exists closest_evidence_id bigint;
alter table public.member_submissions
  add column if not exists submitted_outside_window boolean not null default false;

-- FK tới evidences: thêm riêng để chạy lại không lỗi
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'member_submissions_closest_evidence_fk'
  ) then
    alter table public.member_submissions
      add constraint member_submissions_closest_evidence_fk
      foreign key (closest_evidence_id) references public.evidences(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_submissions_checkin_result_chk'
  ) then
    alter table public.member_submissions
      add constraint member_submissions_checkin_result_chk
      check (
        checkin_result is null
        or checkin_result in ('in_range', 'out_of_range', 'no_coords', 'low_accuracy')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'member_submissions_coord_source_chk'
  ) then
    alter table public.member_submissions
      add constraint member_submissions_coord_source_chk
      check (coord_source is null or coord_source in ('gps', 'manual', 'link'));
  end if;
end $$;

comment on column public.member_submissions.distance_m is
  'Khoảng cách NHỎ NHẤT từ ảnh minh chứng tới điểm tổ chức (mét). Do trigger tính.';
comment on column public.member_submissions.radius_applied_m is
  'Bán kính đã áp dụng lúc tính. Lưu lại để sửa cấu hình sau không đổi kết quả cũ.';
comment on column public.member_submissions.checkin_result is
  'Kết quả check-in: in_range / out_of_range / no_coords / low_accuracy. NULL = chưa tính hoặc nhiệm vụ không có toạ độ.';
comment on column public.member_submissions.coord_source is
  'Nguồn toạ độ yếu nhất trong các ảnh: gps / manual / link. NULL = chưa xác định.';
comment on column public.member_submissions.submitted_outside_window is
  'Nộp ngoài khung giờ điểm danh của nhiệm vụ. Vẫn cho nộp, chỉ gắn cờ.';

-- ---------------------------------------------------------------------
-- 4. MINH CHỨNG — lưu sai số và nguồn toạ độ của từng ảnh
-- ---------------------------------------------------------------------
alter table public.evidences
  add column if not exists accuracy_m   numeric(6,1);
alter table public.evidences
  add column if not exists coord_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'evidences_accuracy_chk'
  ) then
    alter table public.evidences
      add constraint evidences_accuracy_chk
      check (accuracy_m is null or accuracy_m >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'evidences_coord_source_chk'
  ) then
    alter table public.evidences
      add constraint evidences_coord_source_chk
      check (coord_source is null or coord_source in ('gps', 'manual', 'link'));
  end if;
end $$;

comment on column public.evidences.accuracy_m is
  'Sai số GPS do thiết bị báo về (mét). NULL với minh chứng không phải ảnh.';
comment on column public.evidences.coord_source is
  'Nguồn toạ độ: gps (thiết bị) / manual (nhập tay) / link (dán Google Maps).';

-- ---------------------------------------------------------------------
-- 5. HÀM HAVERSINE — khoảng cách trên mặt cầu, đơn vị mét
-- ---------------------------------------------------------------------
create or replace function public.haversine_m(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
) returns double precision
language sql
immutable
parallel safe
as $$
  select 2 * 6371000 * asin(
    least(1.0, sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
    ))
  );
$$;

comment on function public.haversine_m(double precision, double precision, double precision, double precision)
  is 'Khoảng cách Haversine giữa 2 toạ độ, đơn vị mét. Bán kính Trái Đất 6371 km.';

revoke all on function public.haversine_m(double precision, double precision, double precision, double precision) from public;
grant execute on function public.haversine_m(double precision, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- 6. HÀM TÍNH CHECK-IN CHO MỘT LƯỢT NỘP
--    Gọi từ trigger. Không gọi trực tiếp từ client.
-- ---------------------------------------------------------------------
-- Trả về bộ giá trị kết quả, KHÔNG tự update (để tránh đệ quy trigger).
create or replace function private.calc_checkin(p_submission_id bigint)
returns table (
  distance_m          numeric(8,1),
  radius_applied_m    numeric(6,1),
  checkin_result      text,
  closest_evidence_id bigint,
  accuracy_m          numeric(6,1),
  coord_source        text,
  outside_window      boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id        bigint;
  v_task_lat       double precision;
  v_task_lng       double precision;
  v_task_radius    numeric(6,1);
  v_open_at        timestamptz;
  v_close_at       timestamptz;
  v_default_radius numeric(6,1);
  v_max_accuracy   numeric(6,1);
  v_radius         numeric(6,1);
  v_sub_lat        double precision;
  v_sub_lng        double precision;
  v_sub_source     text;
  v_best_dist      double precision;
  v_best_ev_id     bigint;
  v_best_acc       numeric(6,1);
  v_best_source    text;
  v_has_any_coord  boolean := false;
  v_window_year    int;
  v_outside        boolean := false;
  v_result         text;
begin
  select ms.task_id, ms.lat, ms.lng, ms.coord_source
    into v_task_id, v_sub_lat, v_sub_lng, v_sub_source
  from public.member_submissions ms
  where ms.id = p_submission_id;

  if v_task_id is null then
    return;
  end if;

  select t.lat, t.lng, t.radius_m, t.attendance_open_at, t.attendance_close_at,
         extract(year from coalesce(t.due_date::timestamptz, now()))::int
    into v_task_lat, v_task_lng, v_task_radius, v_open_at, v_close_at, v_window_year
  from public.tasks t
  where t.id = v_task_id;

  -- Nhiệm vụ KHÔNG có toạ độ (hoặc chỉ có 1 trong 2) -> bỏ qua hoàn toàn,
  -- trả về toàn NULL để xoá sạch mọi nhãn còn sót.
  -- (Bài nộp cũ không bị backfill vì trigger chỉ chạy khi lat/lng thay đổi.)
  if v_task_lat is null or v_task_lng is null then
    return query select null::numeric(8,1), null::numeric(6,1), null::text,
                        null::bigint, null::numeric(6,1), null::text, false;
    return;
  end if;

  -- Tầng 1: mặc định của năm. Không có dòng năm đó thì dùng 100m / 100m.
  select ys.default_radius_m, ys.max_accuracy_m
    into v_default_radius, v_max_accuracy
  from public.yearly_settings ys
  where ys.year = v_window_year;

  v_default_radius := coalesce(v_default_radius, 100);
  v_max_accuracy   := coalesce(v_max_accuracy, 100);

  -- Tầng 2 thắng tầng 1
  v_radius := coalesce(v_task_radius, v_default_radius);

  -- Khung giờ điểm danh: ngoài khung vẫn cho nộp, chỉ gắn cờ
  if v_open_at is not null and now() < v_open_at then
    v_outside := true;
  end if;
  if v_close_at is not null and now() > v_close_at then
    v_outside := true;
  end if;

  -- Chọn ảnh để xét. Thứ tự ưu tiên:
  --   (1) Ảnh có sai số đạt ngưỡng, khoảng cách nhỏ nhất  -> kết quả đáng tin
  --   (2) Không ảnh nào đạt ngưỡng -> lấy ảnh sai số TỐT NHẤT (nhỏ nhất),
  --       rồi mới xét khoảng cách -> sẽ ra nhãn 'low_accuracy'
  -- Lý do: nếu chỉ lấy khoảng cách nhỏ nhất mà không xét sai số, một ảnh
  -- báo "cách 10 m nhưng sai số 500 m" sẽ đè mất một ảnh "cách 200 m, sai số 5 m"
  -- dù ảnh sau mới là ảnh đáng tin.
  select e.id, e.accuracy_m, e.coord_source,
         public.haversine_m(v_task_lat, v_task_lng, e.lat, e.lng) as dist
    into v_best_ev_id, v_best_acc, v_best_source, v_best_dist
  from public.evidences e
  where e.member_submission_id = p_submission_id
    and e.lat is not null
    and e.lng is not null
  order by
    -- đạt ngưỡng sai số lên trước
    case when coalesce(e.accuracy_m, 0) <= coalesce(v_max_accuracy, 100) then 0 else 1 end,
    -- trong nhóm đạt ngưỡng: gần nhất thắng
    -- trong nhóm không đạt: sai số tốt nhất thắng
    case when coalesce(e.accuracy_m, 0) <= coalesce(v_max_accuracy, 100)
         then public.haversine_m(v_task_lat, v_task_lng, e.lat, e.lng)
         else coalesce(e.accuracy_m, 0)
    end asc,
    e.id asc
  limit 1;

  if v_best_ev_id is not null then
    v_has_any_coord := true;
  end if;

  -- Không ảnh nào có GPS: dùng toạ độ nhập tay của lượt nộp (nếu có)
  if not v_has_any_coord then
    if v_sub_lat is not null and v_sub_lng is not null then
      v_best_dist   := public.haversine_m(v_task_lat, v_task_lng, v_sub_lat, v_sub_lng);
      v_best_source := coalesce(v_sub_source, 'manual');
      v_has_any_coord := true;
    end if;
  end if;

  if not v_has_any_coord then
    return query select null::numeric(8,1), v_radius, 'no_coords'::text,
                        null::bigint, null::numeric(6,1), null::text, v_outside;
    return;
  end if;

  -- Phân loại
  if v_best_acc is not null and v_max_accuracy is not null and v_best_acc > v_max_accuracy then
    v_result := 'low_accuracy';
  elsif v_best_dist <= v_radius then
    v_result := 'in_range';
  else
    v_result := 'out_of_range';
  end if;

  return query select round(v_best_dist::numeric, 1), v_radius, v_result,
                      v_best_ev_id, v_best_acc, coalesce(v_best_source, 'gps'), v_outside;
end;
$$;

revoke all on function private.calc_checkin(bigint) from public;
grant execute on function private.calc_checkin(bigint) to authenticated;

-- ---------------------------------------------------------------------
-- 7. XOÁ CỘT KẾT QUẢ DO CLIENT GỬI LÊN (chống giả mạo)
--    Chạy BEFORE mọi INSERT/UPDATE để client không ghi được kết quả.
-- ---------------------------------------------------------------------
create or replace function private.reset_checkin_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.distance_m          := null;
  new.radius_applied_m    := null;
  new.checkin_result      := null;
  new.closest_evidence_id := null;
  new.accuracy_m          := null;
  new.submitted_outside_window := false;
  -- coord_source là ĐẦU VÀO (client khai báo nguồn toạ độ), không phải kết quả
  -- tính -> giữ nguyên, không xoá.
  return new;
end;
$$;

-- HƯỚNG GIẢI QUYẾT ĐỆ QUY:
--   Cách 1 (đã cân nhắc, KHÔNG dùng): viết kết quả trong cùng lệnh INSERT/UPDATE
--   của client bằng BEFORE trigger. Nhưng lúc đó ảnh minh chứng CHƯA được chèn
--   (submitMemberResult ghi member_submissions trước, evidences sau), nên không
--   thể tính khoảng cách.
--   Cách 2 (đang dùng): BEFORE trigger XOÁ SẠCH cột kết quả khỏi dữ liệu client
--   gửi lên (chống giả mạo), rồi AFTER trigger tính lại và UPDATE riêng. Lệnh
--   UPDATE đó không đụng lat/lng nên 2 trigger dưới đây không kích hoạt lại.
-- BẮT BUỘC có danh sách cột (lat, lng). Nếu để `before insert or update`
-- không giới hạn cột, thì chính lệnh UPDATE của apply_checkin() cũng kích hoạt
-- trigger này và xoá sạch kết quả vừa tính.
drop trigger if exists trg_reset_checkin_columns on public.member_submissions;
create trigger trg_reset_checkin_columns
  before insert or update of lat, lng on public.member_submissions
  for each row execute function private.reset_checkin_columns();

-- ---------------------------------------------------------------------
-- 8. TRIGGER TÍNH TOÁN
--    - AFTER INSERT/UPDATE trên member_submissions: tính lại khi lat/lng đổi
--    - AFTER INSERT/DELETE trên evidences: bộ ảnh đổi -> tính lại lượt nộp cha
-- ---------------------------------------------------------------------
create or replace function private.apply_checkin(p_submission_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  select * into r from private.calc_checkin(p_submission_id);
  -- calc_checkin trả 0 dòng khi không tìm thấy lượt nộp -> bỏ qua
  if not found then
    return;
  end if;

  update public.member_submissions ms
     set distance_m              = r.distance_m,
         radius_applied_m        = r.radius_applied_m,
         checkin_result          = r.checkin_result,
         closest_evidence_id     = r.closest_evidence_id,
         accuracy_m              = r.accuracy_m,
         coord_source            = r.coord_source,
         submitted_outside_window = r.outside_window
   where ms.id = p_submission_id;
end;
$$;

revoke all on function private.apply_checkin(bigint) from public;
grant execute on function private.apply_checkin(bigint) to authenticated;

create or replace function private.trg_member_submissions_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform private.apply_checkin(new.id);
  return new;
end;
$$;

drop trigger if exists trg_member_submissions_checkin on public.member_submissions;
create trigger trg_member_submissions_checkin
  after insert or update of lat, lng on public.member_submissions
  for each row execute function private.trg_member_submissions_checkin();

create or replace function private.trg_evidences_recompute_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id bigint;
begin
  if tg_op = 'DELETE' then
    v_submission_id := old.member_submission_id;
    if v_submission_id is not null then
      perform private.apply_checkin(v_submission_id);
    end if;
    return old;
  end if;

  v_submission_id := new.member_submission_id;
  if v_submission_id is not null then
    perform private.apply_checkin(v_submission_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evidences_recompute_checkin on public.evidences;
create trigger trg_evidences_recompute_checkin
  after insert or delete on public.evidences
  for each row execute function private.trg_evidences_recompute_checkin();

-- ---------------------------------------------------------------------
-- 9. PHÂN QUYỀN
--    - member: nộp cho mình qua code hiện có (policy sẵn có giữ nguyên)
--    - unit_secretary: duyệt bài của đơn vị mình (policy sẵn có giữ nguyên)
--    - Kết quả check-in do trigger ghi, client không ghi được (đã chặn ở mục 7)
--    - Bí thư chi đoàn tạo nhiệm vụ: cần UPDATE tasks trong phạm vi của mình
--      (đã có ở phase12) — thêm cho phép ghi radius_m/attendance_* là cột thường,
--      không cần policy riêng vì policy theo HÀNG, không theo CỘT.
-- ---------------------------------------------------------------------

-- Đảm bảo bí thư chi đoàn đọc được evidences của đơn vị mình (phục vụ màn hình duyệt)
alter table public.evidences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'evidences'
      and policyname = 'evidences_select_secretary_unit'
  ) then
    execute $pol$
      create policy evidences_select_secretary_unit on public.evidences
        for select to authenticated
        using (
          private.is_unit_secretary()
          and unit_id = private.my_unit_id()
        )
    $pol$;
  end if;
end $$;

-- Cấu hình năm: chỉ admin/super_admin được sửa (policy đã có ở giai đoạn trước;
-- nếu chưa có thì thêm).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'yearly_settings'
      and policyname = 'yearly_settings_write_admin'
  ) then
    execute $pol$
      create policy yearly_settings_write_admin on public.yearly_settings
        for all to authenticated
        using (private.is_admin())
        with check (private.is_admin())
    $pol$;
  end if;
end $$;

commit;

-- =====================================================================
-- KIỂM TRA SAU KHI CHẠY
-- =====================================================================
select 'cot_moi' as nhom, count(*) as so_luong
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'member_submissions' and column_name in
      ('accuracy_m','distance_m','radius_applied_m','checkin_result','coord_source',
       'closest_evidence_id','submitted_outside_window'))
    or (table_name = 'tasks' and column_name in
      ('radius_m','attendance_open_at','attendance_close_at'))
    or (table_name = 'evidences' and column_name in ('accuracy_m','coord_source'))
    or (table_name = 'yearly_settings' and column_name in ('default_radius_m','max_accuracy_m'))
  );

select 'trigger' as nhom, count(*) as so_luong
from pg_trigger
where not tgisinternal
  and tgname in ('trg_reset_checkin_columns','trg_member_submissions_checkin','trg_evidences_recompute_checkin');

-- Thử công thức Haversine: (10.0,106.0) -> (10.001,106.0) xấp xỉ 111 m
select public.haversine_m(10.0, 106.0, 10.001, 106.0) as khoang_cach_m;  -- ~111.2

-- Cấu hình hiện tại
select year, default_radius_m, max_accuracy_m
from public.yearly_settings
order by year desc;