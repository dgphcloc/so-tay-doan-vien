-- =====================================================================
-- GIAI ĐOẠN 4 · ĐĂNG NHẬP GOOGLE + TỰ TẠO HỒ SƠ ĐOÀN VIÊN
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
--
-- Luồng:
--   1. Người dùng bấm "Đăng nhập bằng Google" -> Supabase Auth tạo auth.users.
--   2. App kiểm tra đã có profiles chưa. Chưa có -> hiện form thông tin.
--   3. Người dùng điền form -> xem lại -> bấm xác nhận.
--   4. App gọi RPC dưới đây: tạo members + profiles (role mặc định = member).
--
-- Bảo mật: hàm SECURITY DEFINER nhưng CHỈ dùng auth.uid() của người gọi,
-- không nhận id từ client; không cho gán vai trò khác 'member'.
-- =====================================================================

create or replace function public.self_register_member(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_member_id  bigint;
  v_role_id    smallint;
  v_existing   bigint;
  v_full_name  text;
  v_birth      date;
  v_gender     gender_type;
  v_unit_id    bigint;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'message', 'Chưa đăng nhập');
  end if;

  -- Đã có hồ sơ gắn tài khoản này thì không tạo thêm
  select member_id into v_existing from public.profiles where id = v_uid;
  if found and v_existing is not null then
    return jsonb_build_object('success', false, 'message', 'Tài khoản đã có hồ sơ đoàn viên', 'member_id', v_existing);
  end if;

  -- Bắt buộc: họ tên, ngày sinh, giới tính, chi đoàn
  v_full_name := btrim(coalesce(p->>'full_name', ''));
  if v_full_name = '' then
    return jsonb_build_object('success', false, 'message', 'Thiếu họ và tên');
  end if;
  if (p->>'birth_date') is null or (p->>'birth_date') = '' then
    return jsonb_build_object('success', false, 'message', 'Thiếu ngày sinh');
  end if;
  begin
    v_birth := (p->>'birth_date')::date;
  exception when others then
    return jsonb_build_object('success', false, 'message', 'Ngày sinh không hợp lệ');
  end;
  if v_birth <= date '1900-01-01' or v_birth > current_date then
    return jsonb_build_object('success', false, 'message', 'Ngày sinh không hợp lệ');
  end if;
  v_gender := coalesce(nullif(p->>'gender', ''), 'other')::gender_type;
  if (p->>'unit_id') is null or (p->>'unit_id') = '' then
    return jsonb_build_object('success', false, 'message', 'Thiếu chi đoàn');
  end if;
  v_unit_id := (p->>'unit_id')::bigint;
  if not exists (select 1 from public.units where id = v_unit_id and is_active) then
    return jsonb_build_object('success', false, 'message', 'Chi đoàn không hợp lệ hoặc đã ngừng hoạt động');
  end if;

  -- Tạo hồ sơ đoàn viên
  insert into public.members (
    full_name, birth_date, gender, phone, joined_date, unit_id,
    current_position, planned_position, education_grade, specialization,
    political_theory_level, is_active, religion, is_party_member,
    ethnicity_id, avatar_url, current_job, note
  ) values (
    v_full_name,
    v_birth,
    v_gender,
    nullif(btrim(coalesce(p->>'phone', '')), ''),
    nullif(p->>'joined_date', '')::date,
    v_unit_id,
    'member',
    'member',
    nullif(p->>'education_grade', '')::smallint,
    nullif(btrim(coalesce(p->>'specialization', '')), ''),
    coalesce(nullif(p->>'political_theory_level', ''), 'elementary')::political_theory_level,
    true,
    coalesce(nullif(btrim(coalesce(p->>'religion', '')), ''), 'Không'),
    coalesce((p->>'is_party_member')::boolean, false),
    nullif(p->>'ethnicity_id', '')::smallint,
    nullif(btrim(coalesce(p->>'avatar_url', '')), ''),
    nullif(btrim(coalesce(p->>'current_job', '')), ''),
    'Tự đăng ký qua Google'
  )
  returning id into v_member_id;

  -- Vai trò LUÔN là member, không lấy từ client
  select id into v_role_id from public.roles where name = 'member';
  if v_role_id is null then
    return jsonb_build_object('success', false, 'message', 'Thiếu vai trò member trong bảng roles');
  end if;

  -- Tạo hoặc cập nhật profile (Google sign-in đã tạo auth.users nên id đã tồn tại)
  insert into public.profiles (id, member_id, role_id, is_active)
  values (v_uid, v_member_id, v_role_id, true)
  on conflict (id) do update
    set member_id = excluded.member_id,
        role_id   = excluded.role_id,
        is_active = true,
        updated_at = now();

  return jsonb_build_object('success', true, 'member_id', v_member_id);
end;
$$;

revoke all on function public.self_register_member(jsonb) from public;
grant execute on function public.self_register_member(jsonb) to authenticated;

-- Cho người chưa có hồ sơ đọc danh sách chi đoàn / dân tộc để điền form đăng ký.
-- (Không lộ dữ liệu cá nhân: chỉ id + tên.)
create or replace function public.signup_options()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    -- Sắp xếp tự nhiên: "ấp 1, ấp 2, ..., ấp 10" thay vì "ấp 1, ấp 10, ấp 11, ấp 2".
    -- Tách số ở cuối tên để so sánh dạng số; tên không có số thì xếp sau, theo alphabet.
    'units', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'unit_type_id', unit_type_id) order by sort_num nulls last, name)
      from (
        select id, name, unit_type_id,
               substring(name from '([0-9]+)\s*$')::int as sort_num
        from public.units where is_active
      ) u
    ), '[]'::jsonb),
    'ethnicities', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name)
      from public.ethnicities
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.signup_options() from public;
grant execute on function public.signup_options() to authenticated;

-- Kiểm tra
select public.signup_options() as lua_chon_dang_ky;

-- =====================================================================
-- TRẠNG THÁI HỒ SƠ CỦA TÀI KHOẢN ĐANG ĐĂNG NHẬP
-- AuthGate dùng hàm này thay vì đọc thẳng bảng profiles (RLS có thể chặn).
-- Chỉ trả thông tin của CHÍNH người gọi.
-- =====================================================================

create or replace function public.my_profile_state()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'has_profile', (p.member_id is not null),
    'member_id',   p.member_id,
    'role',        r.name,
    'is_active',   p.is_active
  )
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

revoke all on function public.my_profile_state() from public;
grant execute on function public.my_profile_state() to authenticated;

select public.my_profile_state() as trang_thai_ho_so_cua_toi;
