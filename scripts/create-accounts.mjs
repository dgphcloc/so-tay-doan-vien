/**
 * Tạo tài khoản đăng nhập cho đoàn viên (hồ sơ đã có trong bảng members).
 *
 * Cần service_role key:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node scripts/create-accounts.mjs --limit=5
 *
 * Tùy chọn:
 *   --limit=N     chỉ tạo N tài khoản đầu (mặc định 5) để tránh tạo quá nhiều
 *   --role=member  vai trò gán cho tài khoản (mặc định member)
 *   --only-seed   chỉ tạo cho các hồ sơ có note bắt đầu bằng 'SEED'
 *
 * Mật khẩu mặc định: 123456. Email: dv<memberId>@example.com
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const limit = Number(args['limit'] ?? 5);
const roleName = String(args['role'] ?? 'member');
const onlySeed = !!args['only-seed'];
const PASSWORD = '123456';

async function main() {
  // Lấy role_id của vai trò
  const { data: role } = await supabase.from('roles').select('id').eq('name', roleName).maybeSingle();
  if (!role) { console.error(`Không tìm thấy vai trò "${roleName}".`); process.exit(1); }

  // Lấy đoàn viên chưa có tài khoản (profiles.member_id)
  let q = supabase.from('members').select('id, full_name, unit_id').eq('is_active', true).order('id');
  if (onlySeed) q = q.like('note', 'SEED%');
  const { data: members, error } = await q.limit(limit);
  if (error) { console.error('Lỗi đọc members:', error.message); process.exit(1); }

  const { data: profs } = await supabase.from('profiles').select('member_id');
  const linked = new Set((profs ?? []).map(p => String(p.member_id)));

  let created = 0;
  for (const m of members) {
    if (linked.has(String(m.id))) { console.log(`- ${m.full_name}: đã có tài khoản, bỏ qua.`); continue; }
    const email = `dv${m.id}@example.com`;
    const { data: userRes, error: uErr } = await supabase.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
    });
    if (uErr) { console.error(`- ${m.full_name} (${email}): LỖI tạo user — ${uErr.message}`); continue; }
    const { error: pErr } = await supabase.from('profiles').insert({
      id: userRes.user.id, member_id: m.id, role_id: role.id, is_active: true,
    });
    if (pErr) { console.error(`- ${m.full_name}: tạo user ok nhưng lỗi profile — ${pErr.message}`); continue; }
    created++;
    console.log(`- ${m.full_name}: tạo ${email} / ${PASSWORD}`);
  }
  console.log(`\nXong. Tạo ${created} tài khoản (vai trò ${roleName}).`);
}
main().catch(e => { console.error(e); process.exit(1); });
