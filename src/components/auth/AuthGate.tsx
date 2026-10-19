import React, { useCallback, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, dataSource, clearAuthCache } from '../../data';
import { LoginPage } from '../../pages/LoginPage';
import { SignupPage } from '../../pages/SignupPage';
import { Loader2 } from 'lucide-react';

/** Trạng thái hồ sơ của tài khoản đang đăng nhập. */
type ProfileState = 'unknown' | 'has-profile' | 'needs-signup';

/**
 * Cổng xác thực:
 *  - Chế độ mock (không cấu hình Supabase): cho qua ngay, không cần đăng nhập.
 *  - Chế độ Supabase: bắt buộc đăng nhập, và nếu tài khoản chưa có hồ sơ đoàn viên
 *    (đăng nhập Google lần đầu) thì bắt hoàn tất hồ sơ trước khi vào ứng dụng.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const needsAuth = dataSource === 'supabase' && isSupabaseConfigured();
  const [checking, setChecking] = useState(needsAuth);
  const [authed, setAuthed] = useState(!needsAuth);
  const [profileState, setProfileState] = useState<ProfileState>('unknown');
  const [email, setEmail] = useState<string | null>(null);
  const [googleName, setGoogleName] = useState<string | undefined>(undefined);
  const [googleAvatar, setGoogleAvatar] = useState<string | undefined>(undefined);

  /** Đọc profile + metadata Google của phiên hiện tại. */
  const loadProfileState = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setProfileState('unknown'); return; }

    setEmail(auth.user.email ?? null);
    const meta = (auth.user.user_metadata ?? {}) as Record<string, unknown>;
    const name = typeof meta.full_name === 'string' ? meta.full_name
      : typeof meta.name === 'string' ? meta.name : undefined;
    const avatar = typeof meta.avatar_url === 'string' ? meta.avatar_url
      : typeof meta.picture === 'string' ? meta.picture : undefined;
    setGoogleName(name);
    setGoogleAvatar(avatar);

    // Dùng RPC để không phụ thuộc policy SELECT của bảng profiles
    const { data: state, error: stErr } = await supabase.rpc('my_profile_state');
    if (stErr) {
      // Chưa chạy migration phase4: thử đọc trực tiếp, hỏng thì coi như đã có hồ sơ
      // để không chặn người dùng đang dùng bình thường.
      const { data: prof } = await supabase.from('profiles')
        .select('member_id').eq('id', auth.user.id).maybeSingle();
      const memberId = (prof as { member_id?: number | null } | null)?.member_id;
      setProfileState(memberId ? 'has-profile' : 'needs-signup');
      return;
    }
    const r = (state ?? {}) as { has_profile?: boolean };
    setProfileState(r.has_profile ? 'has-profile' : 'needs-signup');
  }, []);

  useEffect(() => {
    if (!needsAuth || !supabase) return;

    let mounted = true;
    supabase.auth.getSession().then(async ({ data }: { data: { session: unknown } }) => {
      if (!mounted) return;
      const hasSession = !!data.session;
      setAuthed(hasSession);
      if (hasSession) await loadProfileState();
      if (mounted) setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event: string, session: unknown) => {
      // Xóa cache người dùng để đổi tài khoản/đăng xuất là cập nhật ngay
      clearAuthCache();
      setAuthed(!!session);
      if (session) {
        loadProfileState();
      } else {
        setProfileState('unknown');
        setEmail(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [needsAuth, loadProfileState]);

  const signOut = async () => {
    await supabase?.auth.signOut();
    setProfileState('unknown');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-[#1F5FBF]" />
      </div>
    );
  }

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  // Đã đăng nhập nhưng chưa xác định được hồ sơ: chờ đọc xong để tránh nháy form
  if (needsAuth && profileState === 'unknown') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-[#1F5FBF]" />
      </div>
    );
  }

  // Đăng nhập Google lần đầu: bắt hoàn tất hồ sơ (vai trò mặc định = member)
  if (needsAuth && profileState === 'needs-signup') {
    return (
      <SignupPage
        email={email}
        suggestedName={googleName}
        suggestedAvatar={googleAvatar}
        onDone={() => { clearAuthCache(); loadProfileState(); }}
        onSignOut={signOut}
      />
    );
  }

  return <>{children}</>;
};
