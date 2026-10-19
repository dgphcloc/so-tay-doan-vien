-- =====================================================================
-- GIAI ĐOẠN 2 · TỰ PHỤC VỤ: đoàn viên tự sửa hồ sơ của mình (trường an toàn)
-- Chạy trong Supabase SQL Editor. An toàn khi chạy lại.
-- =====================================================================

create or replace function public.member_self_update(p jsonb) returns jsonb
    language plpgsql security definer
    set search_path to ''
as $$
declare
  v_id bigint := private.my_member_id();
  v_bad text[];
  v_phone text;
begin
  if v_id is null then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'message', 'Tài khoản chưa gắn hồ sơ đoàn viên');
  end if;

  -- Chỉ cho sửa các trường an toàn
  select array_agg(k) into v_bad
  from jsonb_object_keys(p) k
  where k not in ('phone','religion','current_job','specialization','political_theory_level','avatar_url','note');
  if v_bad is not null then
    return jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'message', 'Không được phép sửa: ' || array_to_string(v_bad, ', '));
  end if;

  -- Kiểm tra số điện thoại nếu có
  if p ? 'phone' then
    v_phone := nullif(regexp_replace(coalesce(p ->> 'phone', ''), '[^0-9]', '', 'g'), '');
    if v_phone is not null and v_phone !~ '^[0-9]{9,11}$' then
      return jsonb_build_object('success', false, 'code', 'INVALID',
        'message', 'Số điện thoại phải có 9-11 chữ số');
    end if;
  end if;

  update public.members m set
    phone = case when p ? 'phone' then v_phone else m.phone end,
    religion = case when p ? 'religion' then coalesce(nullif(btrim(p ->> 'religion'), ''), 'Không') else m.religion end,
    current_job = case when p ? 'current_job' then nullif(btrim(p ->> 'current_job'), '') else m.current_job end,
    specialization = case when p ? 'specialization' then nullif(btrim(p ->> 'specialization'), '') else m.specialization end,
    political_theory_level = case when p ? 'political_theory_level'
      then coalesce((p ->> 'political_theory_level')::public.political_theory_level, m.political_theory_level)
      else m.political_theory_level end,
    avatar_url = case when p ? 'avatar_url' then nullif(btrim(p ->> 'avatar_url'), '') else m.avatar_url end,
    note = case when p ? 'note' then nullif(btrim(p ->> 'note'), '') else m.note end
  where m.id = v_id;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'code', 'INVALID', 'message', sqlerrm);
end $$;

revoke all on function public.member_self_update(jsonb) from public, anon;
grant execute on function public.member_self_update(jsonb) to authenticated;

-- Kiểm tra
select proname from pg_proc where proname = 'member_self_update';
