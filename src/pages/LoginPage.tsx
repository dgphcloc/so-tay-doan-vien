import React, { useState } from 'react';
import { supabase } from '../data';
import { BookOpen, LogIn, Loader2, AlertCircle } from 'lucide-react';

/** Biểu tượng Google (không dùng logo chính thức để tránh vấn đề nhãn hiệu). */
const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

/**
 * Màn hình đăng nhập (chỉ dùng khi chạy với Supabase thật).
 * Đăng nhập bằng email + mật khẩu của tài khoản đã tạo trong Supabase Auth.
 */
export const LoginPage: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(
        /invalid login credentials/i.test(signInError.message)
          ? 'Email hoặc mật khẩu không đúng'
          : signInError.message
      );
      return;
    }
    onSuccess?.();
  };

  const signInWithGoogle = async () => {
    if (!supabase) return;
    setError(null);
    setGoogleBusy(true);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Quay lại đúng trang hiện tại sau khi Google xác thực (HashRouter nên dùng origin + pathname)
        redirectTo: `${window.location.origin}${window.location.pathname}`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (e) {
      setGoogleBusy(false);
      setError(e.message);
    }
    // Thành công: trình duyệt chuyển sang Google, không cần setState nữa
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-[#1F5FBF] flex items-center justify-center text-white mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Sổ tay Đoàn viên</h1>
          <p className="text-xs text-slate-500 mt-1">Đăng nhập để quản trị công tác Đoàn xã</p>
        </div>

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={busy || googleBusy}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 mb-4 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition"
        >
          {googleBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon className="w-4 h-4" />}
          {googleBusy ? 'Đang chuyển tới Google…' : 'Đăng nhập bằng Google'}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-[11px] text-slate-400">hoặc dùng email</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FBF]/40"
              placeholder="ten@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Mật khẩu</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FBF]/40"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1F5FBF] rounded-lg hover:bg-[#1a52a5] disabled:opacity-60 transition"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};
