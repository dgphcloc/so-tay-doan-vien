/**
 * Tạo hồ sơ đoàn viên MẪU cho tất cả chi đoàn (dữ liệu giả để test).
 *
 * CHẠY 1 LẦN. Cần service_role key (bỏ qua RLS):
 *   Windows PowerShell:  $env:SUPABASE_URL="https://xxx.supabase.co"; $env:SUPABASE_SERVICE_ROLE="..."; node scripts/seed-members.mjs
 *   Git Bash:            SUPABASE_URL=... SUPABASE_SERVICE_ROLE=... node scripts/seed-members.mjs
 *
 * Tùy chọn:
 *   --per-unit=12   số đoàn viên mẫu mỗi chi đoàn (mặc định 12)
 *   --dry-run       chỉ xem trước, không ghi
 *
 * LƯU Ý: đây là DỮ LIỆU GIẢ. Xóa bằng: delete from members where note like 'SEED%';
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE trong biến môi trường.');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const perUnit = Number(args['per-unit'] ?? 12);
const dryRun = !!args['dry-run'];

// Tên Việt Nam để sinh ngẫu nhiên
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Huỳnh', 'Phan', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trương'];
const DEM = ['Văn', 'Thị', 'Minh', 'Thanh', 'Hoàng', 'Quốc', 'Ngọc', 'Hữu', 'Thành', 'Kim', 'Mỹ', 'Tuấn'];
const TEN = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Giang', 'Hà', 'Hùng', 'Khanh', 'Lan', 'Long', 'Mai', 'Nam', 'Nga', 'Oanh', 'Phát', 'Quyên', 'Sơn', 'Tú', 'Vy', 'Yến', 'Thảo', 'Trang', 'Nhung', 'Tuyền'];

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function makeName() {
  return `${rnd(HO)} ${rnd(DEM)} ${rnd(TEN)}`;
}
function makePhone() {
  const p = ['090', '091', '093', '094', '096', '097', '098', '039', '070', '079'];
  return rnd(p) + String(rndInt(1000000, 9999999));
}
function makeBirth() {
  const y = rndInt(1996, 2008);
  const m = String(rndInt(1, 12)).padStart(2, '0');
  const d = String(rndInt(1, 28)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function makeJoined(birthYear) {
  const y = birthYear + rndInt(15, 20);
  return `${Math.min(y, 2025)}-03-26`;
}

async function main() {
  // Lấy tất cả chi đoàn đang hoạt động
  const { data: units, error: uErr } = await supabase.from('units').select('id, name, union_member_count').eq('is_active', true).order('id');
  if (uErr) { console.error('Lỗi đọc units:', uErr.message); process.exit(1); }
  console.log(`Có ${units.length} chi đoàn. Sinh ~${perUnit} đoàn viên/chi đoàn${dryRun ? ' (DRY RUN)' : ''}...`);

  let totalInserted = 0;
  for (const unit of units) {
    // Đếm đoàn viên hiện có của chi đoàn
    const { count } = await supabase.from('members').select('id', { count: 'exact', head: true }).eq('unit_id', unit.id);
    const existing = count ?? 0;
    const need = Math.max(0, perUnit - existing);

    const rows = [];
    for (let i = 0; i < need; i++) {
      const birth = makeBirth();
      rows.push({
        full_name: makeName(),
        birth_date: birth,
        gender: Math.random() < 0.5 ? 'male' : 'female',
        phone: makePhone(),
        joined_date: makeJoined(Number(birth.slice(0, 4))),
        unit_id: unit.id,
        current_position: 'member',
        education_grade: String(rndInt(6, 12)),
        political_theory_level: 'elementary',
        is_active: true,
        religion: 'Không',
        is_party_member: false,
        avatar_url: `https://i.pravatar.cc/80?u=seed_${unit.id}_${i}`,
        current_job: 'Lao động tự do',
        central_member_code: null,
        note: `SEED (dữ liệu mẫu ${unit.name})`,
      });
    }

    if (rows.length === 0) { console.log(`- ${unit.name}: đã đủ (${existing}), bỏ qua.`); continue; }
    if (dryRun) { console.log(`- ${unit.name}: sẽ thêm ${rows.length} (hiện ${existing}).`); totalInserted += rows.length; continue; }

    const { error } = await supabase.from('members').insert(rows);
    if (error) { console.error(`- ${unit.name}: LỖI ${error.message}`); continue; }
    totalInserted += rows.length;

    // Cập nhật số khai báo = số thực tế
    const newTotal = existing + rows.length;
    await supabase.from('units').update({ union_member_count: newTotal }).eq('id', unit.id);
    console.log(`- ${unit.name}: +${rows.length} (tổng ${newTotal}).`);
  }
  console.log(`\nXong. Tổng ${totalInserted} hồ sơ${dryRun ? ' (chưa ghi)' : ' đã ghi'}.`);
  console.log('Xóa dữ liệu mẫu sau này: delete from public.members where note like \'SEED%\';');
}
main().catch(e => { console.error(e); process.exit(1); });
