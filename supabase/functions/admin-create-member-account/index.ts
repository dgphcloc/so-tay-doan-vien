// =====================================================================
// SUPABASE EDGE FUNCTION: TẠO TÀI KHOẢN ĐĂNG NHẬP CHO ĐOÀN VIÊN
//
// Deploy:
//   supabase functions deploy admin-create-member-account --no-verify-jwt --yes
//
// KHÔNG cần set secret: SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY được
// Supabase tự inject vào mọi Edge Function.
//
// VÌ SAO PHẢI DÙNG EDGE FUNCTION:
//   Tạo user trong auth.users cần service_role key. Key đó TUYỆT ĐỐI không
//   được đưa xuống trình duyệt — ai đọc được là chiếm toàn bộ database.
//   Nên phải chạy trên server, sau khi đã xác thực người gọi là admin.
//
// BẢO MẬT:
//   1. Xác thực JWT của người gọi (Authorization header)
//   2. Tra profiles.role_id của người đó -> phải là admin/super_admin
//   3. Chỉ khi qua 2 bước trên mới gọi Admin API
//
// HAI CHẾ ĐỘ:
//   action = 'single'  -> tạo 1 tài khoản cho 1 đoàn viên
//   action = 'bulk'    -> tạo hàng loạt cho mọi đoàn viên chưa có tài khoản
// =====================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Mật khẩu mặc định khi tạo hàng loạt. Đủ mạnh để qua policy của Supabase. */
const DEFAULT_PASSWORD = 'DoanVien@2026';

// @ts-ignore - Deno runtime
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Gọi REST API của Supabase bằng service_role (bỏ qua RLS). */
async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'apikey': SERVICE_ROLE,
      'Authorization': `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

/** Lấy UUID + role của người gọi từ JWT. Trả null nếu không hợp lệ. */
async function getCallerRole(
  authHeader: string | null
): Promise<{ userId: string; role: string | null } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length);

  // Xác thực token bằng chính Supabase Auth
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json() as { id?: string };
  if (!user?.id) return null;

  // Đọc role từ profiles (join roles để lấy tên)
  const profRes = await adminFetch(
    `/rest/v1/profiles?select=id,role:roles(name)&id=eq.${user.id}&limit=1`
  );
  if (!profRes.ok) return { userId: user.id, role: null };
  const rows = await profRes.json() as Array<{ role: { name: string } | { name: string }[] | null }>;
  const r = rows[0]?.role;
  const roleName = Array.isArray(r) ? (r[0]?.name ?? null) : (r?.name ?? null);
  return { userId: user.id, role: roleName };
}

interface CreateOneInput {
  email: string;
  password?: string;
  memberId: number;
  fullName: string;
  roleId?: string;
}

/**
 * Tạo một tài khoản: auth.users -> profiles -> gắn member_id.
 * Trả về { ok, email, message } — không ném lỗi để chế độ bulk chạy tiếp.
 */
async function createOne(
  input: CreateOneInput
): Promise<{ ok: boolean; email: string; message?: string; userId?: string }> {
  const password = input.password || DEFAULT_PASSWORD;

  // 1. Tạo user trong auth.users.
  //    email_confirm: true -> không gửi mail xác nhận, đăng nhập được ngay.
  const createRes = await adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    const msg = /already been registered|already registered|duplicate/i.test(err)
      ? 'Email đã có tài khoản'
      : err.slice(0, 200);
    return { ok: false, email: input.email, message: msg };
  }

  const created = await createRes.json() as { id?: string; user?: { id?: string } };
  const userId = created?.id ?? created?.user?.id;
  if (!userId) return { ok: false, email: input.email, message: 'Không lấy được id người dùng mới' };

  // 2. Gắn hồ sơ: profiles đã có thể tồn tại (do trigger) hoặc chưa.
  //    Upsert để chạy đúng cả hai trường hợp.
  const roleRes = await adminFetch(`/rest/v1/roles?select=id,name&name=eq.${input.roleId || 'member'}&limit=1`);
  const roleRows = await roleRes.json() as Array<{ id: number }>;
  const roleIdNum = roleRows[0]?.id;
  if (!roleIdNum) {
    return { ok: false, email: input.email, message: `Không tìm thấy role "${input.roleId || 'member'}"`, userId };
  }

  const profRes = await adminFetch('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: userId,
      member_id: input.memberId,
      role_id: roleIdNum,
      is_active: true,
    }),
  });

  if (!profRes.ok) {
    const err = await profRes.text();
    return {
      ok: false,
      email: input.email,
      message: `Đã tạo tài khoản nhưng chưa gắn được hồ sơ: ${err.slice(0, 160)}`,
      userId,
    };
  }

  return { ok: true, email: input.email, userId };
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // --- Bước bảo mật: chỉ admin / super_admin được gọi ---
    const caller = await getCallerRole(req.headers.get('authorization'));
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (caller.role !== 'admin' && caller.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Chỉ Quản trị viên được tạo tài khoản' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const action = body.action || 'single';

    // ---------- Tạo một tài khoản ----------
    if (action === 'single') {
      const { email, password, memberId, fullName, roleId } = body;
      if (!email || !memberId || !fullName) {
        return new Response(JSON.stringify({ error: 'Thiếu email / đoàn viên / họ tên' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      // Kiểm tra đoàn viên đã có tài khoản chưa
      const checkRes = await adminFetch(`/rest/v1/profiles?select=id&member_id=eq.${Number(memberId)}&limit=1`);
      const existing = await checkRes.json() as unknown[];
      if (existing.length > 0) {
        return new Response(JSON.stringify({ error: 'Đoàn viên này đã có tài khoản đăng nhập' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await createOne({
        email: String(email).trim().toLowerCase(),
        password,
        memberId: Number(memberId),
        fullName,
        roleId,
      });
      return new Response(JSON.stringify(result), {
        status: result.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- Tạo hàng loạt ----------
    if (action === 'bulk') {
      const { members, emailDomain, password, roleId } = body as {
        members: Array<{ memberId: number; fullName: string; unitId: number; unitName: string }>;
        emailDomain: string;
        password?: string;
        roleId?: string;
      };
      if (!Array.isArray(members) || members.length === 0) {
        return new Response(JSON.stringify({ error: 'Danh sách đoàn viên trống' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!emailDomain || !emailDomain.includes('.')) {
        return new Response(JSON.stringify({ error: 'Tên miền email không hợp lệ' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Đoàn viên nào đã có tài khoản -> bỏ qua
      const profRes = await adminFetch('/rest/v1/profiles?select=member_id&member_id=not.is.null');
      const takenRows = await profRes.json() as Array<{ member_id: number | string }>;
      const taken = new Set(takenRows.map(r => Number(r.member_id)));

      const results: Array<{ memberId: number; fullName: string; email: string; ok: boolean; message?: string }> = [];

      for (const m of members) {
        if (taken.has(Number(m.memberId))) continue; // đã có tài khoản

        // Sinh email: bỏ dấu tiếng Việt, ghép với id để chắc chắn không trùng
        const slug = String(m.fullName)
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/đ/gi, 'd')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '.')
          .replace(/^\.+|\.+$/g, '')
          .slice(0, 30);
        const email = `${slug || 'doanvien'}${m.memberId}@${emailDomain}`;

        const r = await createOne({
          email,
          password,
          memberId: Number(m.memberId),
          fullName: m.fullName,
          roleId,
        });
        results.push({ memberId: Number(m.memberId), fullName: m.fullName, email, ...r });
      }

      const created = results.filter(r => r.ok).length;
      const failed = results.filter(r => !r.ok).length;
      const skipped = members.length - results.length;

      return new Response(JSON.stringify({
        ok: true,
        created, failed, skipped,
        results,
        defaultPassword: password || DEFAULT_PASSWORD,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Hành động không hợp lệ: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});