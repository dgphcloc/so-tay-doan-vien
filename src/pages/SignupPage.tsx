import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../data';
import { formatDateVN } from '../mock/data';
import {
  UserPlus, Loader2, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2,
  User, Calendar, MapPin, Phone, GraduationCap, Briefcase, Church, Award,
} from 'lucide-react';

/**
 * Đăng ký hồ sơ đoàn viên sau lần đăng nhập Google đầu tiên.
 *
 * 4 bước: Thông tin cơ bản → Học vấn / công việc → Khác → Xem lại & xác nhận.
 * Bước xem lại bắt buộc đếm ngược 3 giây rồi mới bật nút xác nhận, để người dùng
 * có thời gian đọc lại thông tin trước khi tạo tài khoản.
 */

type SignupOptions = {
  units: Array<{ id: string; name: string; unit_type_id: string }>;
  ethnicities: Array<{ id: string; name: string }>;
};

export interface SignupForm {
  full_name: string;
  birth_date: string;
  gender: string;
  unit_id: string;
  phone: string;
  joined_date: string;
  education_grade: string;
  specialization: string;
  political_theory_level: string;
  religion: string;
  is_party_member: boolean;
  ethnicity_id: string;
  avatar_url: string;
  current_job: string;
}

const EMPTY_FORM: SignupForm = {
  full_name: '',
  birth_date: '',
  gender: 'male',
  unit_id: '',
  phone: '',
  joined_date: '',
  education_grade: '',
  specialization: '',
  political_theory_level: 'elementary',
  religion: 'Không',
  is_party_member: false,
  ethnicity_id: '',
  avatar_url: '',
  current_job: '',
};

const POLITICAL_LABEL: Record<string, string> = {
  advanced: 'Cao cấp',
  intermediate: 'Trung cấp',
  elementary: 'Sơ cấp',
  other: 'Khác',
};

const GENDER_LABEL: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
};

interface Props {
  email: string | null;
  /** Thông tin Google trả về (tên, ảnh) để điền sẵn. */
  suggestedName?: string;
  suggestedAvatar?: string;
  onDone: () => void;
  onSignOut: () => void;
}

export const SignupPage: React.FC<Props> = ({ email, suggestedName, suggestedAvatar, onDone, onSignOut }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SignupForm>({
    ...EMPTY_FORM,
    full_name: suggestedName ?? '',
    avatar_url: suggestedAvatar ?? '',
  });
  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Tải chi đoàn / dân tộc bằng RPC (không cần hồ sơ)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setLoadingOptions(false); return; }
      const { data, error: e } = await supabase.rpc('signup_options');
      if (cancelled) return;
      if (e) {
        setError('Không tải được danh sách chi đoàn. Kiểm tra đã chạy migration phase4 chưa.');
        setLoadingOptions(false);
        return;
      }
      const r = (data ?? {}) as SignupOptions;
      setOptions({ units: r.units ?? [], ethnicities: r.ethnicities ?? [] });
      setLoadingOptions(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Đếm ngược ở bước xem lại: 3 giây rồi mới cho xác nhận
  useEffect(() => {
    if (step !== 4) return;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [step]);

  const unitName = useMemo(
    () => options?.units.find(u => u.id === form.unit_id)?.name ?? '—',
    [options, form.unit_id]
  );
  const ethnicityName = useMemo(
    () => options?.ethnicities.find(e => e.id === form.ethnicity_id)?.name ?? '—',
    [options, form.ethnicity_id]
  );

  const set = <K extends keyof SignupForm>(key: K, value: SignupForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  /** Kiểm tra từng bước; trả về lỗi đầu tiên hoặc null. */
  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!form.full_name.trim()) return 'Vui lòng nhập họ và tên.';
      if (!form.birth_date) return 'Vui lòng chọn ngày sinh.';
      if (new Date(form.birth_date) > new Date()) return 'Ngày sinh không được ở tương lai.';
      if (!form.unit_id) return 'Vui lòng chọn chi đoàn.';
      if (form.phone && !/^[0-9]{9,11}$/.test(form.phone.trim())) return 'Số điện thoại phải là 9–11 chữ số.';
    }
    if (s === 2) {
      if (form.education_grade) {
        const g = Number(form.education_grade);
        if (!Number.isInteger(g) || g < 1 || g > 12) return 'Lớp/trình độ phải từ 1 đến 12.';
      }
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => Math.min(4, s + 1));
  };

  const back = () => {
    setError(null);
    setStep(s => Math.max(1, s - 1));
  };

  const submit = async () => {
    if (countdown > 0) return;
    const err = validateStep(1);
    if (err) { setError(err); setStep(1); return; }
    setBusy(true);
    setError(null);
    try {
      if (!supabase) throw new Error('Chưa cấu hình Supabase');
      const { error: e } = await supabase.rpc('self_register_member', {
        p: {
          full_name: form.full_name.trim(),
          birth_date: form.birth_date,
          gender: form.gender,
          unit_id: form.unit_id,
          phone: form.phone.trim() || null,
          joined_date: form.joined_date || null,
          education_grade: form.education_grade || null,
          specialization: form.specialization.trim() || null,
          political_theory_level: form.political_theory_level,
          religion: form.religion.trim() || null,
          is_party_member: form.is_party_member,
          ethnicity_id: form.ethnicity_id || null,
          avatar_url: form.avatar_url.trim() || null,
          current_job: form.current_job.trim() || null,
        },
      });
      if (e) throw new Error(e.message);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = ['Thông tin cơ bản', 'Học vấn & công việc', 'Thông tin khác', 'Xem lại & xác nhận'][step - 1];

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-[#1F5FBF] flex items-center justify-center text-white">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800">Hoàn tất hồ sơ đoàn viên</h1>
            <p className="text-[11px] text-slate-500">{email ?? 'Đã đăng nhập bằng Google'}</p>
          </div>
        </div>

        {/* Tiến trình */}
        <div className="flex items-center gap-1.5 my-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="flex-1">
              <div className={`h-1.5 rounded-full ${n <= step ? 'bg-[#1F5FBF]' : 'bg-slate-200'}`} />
            </div>
          ))}
        </div>
        <p className="text-[11px] font-bold text-[#1F5FBF] uppercase tracking-wide mb-3">
          Bước {step}/4 · {stepTitle}
        </p>

        {loadingOptions && step === 1 ? (
          <div className="p-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-3 text-xs">
            {/* BƯỚC 1 */}
            {step === 1 && (
              <>
                <Field label="Họ và tên (*)" icon={<User className="w-3.5 h-3.5" />}>
                  <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ngày sinh (*)" icon={<Calendar className="w-3.5 h-3.5" />}>
                    <input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                  </Field>
                  <Field label="Giới tính (*)">
                    <select value={form.gender} onChange={e => set('gender', e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]">
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </Field>
                </div>

                <Field label="Chi đoàn (*)" icon={<MapPin className="w-3.5 h-3.5" />}>
                  <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]">
                    <option value="">— Chọn chi đoàn —</option>
                    {options?.units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Số điện thoại" icon={<Phone className="w-3.5 h-3.5" />}>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)}
                      placeholder="09xxxxxxxx" inputMode="numeric"
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                  </Field>
                  <Field label="Ngày vào Đoàn" icon={<Calendar className="w-3.5 h-3.5" />}>
                    <input type="date" value={form.joined_date} onChange={e => set('joined_date', e.target.value)}
                      max={new Date().toISOString().slice(0, 10)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                  </Field>
                </div>
              </>
            )}

            {/* BƯỚC 2 */}
            {step === 2 && (
              <>
                <Field label="Lớp / trình độ học vấn" icon={<GraduationCap className="w-3.5 h-3.5" />}>
                  <input type="number" min={1} max={12} value={form.education_grade}
                    onChange={e => set('education_grade', e.target.value)}
                    placeholder="1 – 12"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                </Field>
                <Field label="Chuyên môn">
                  <input value={form.specialization} onChange={e => set('specialization', e.target.value)}
                    placeholder="Ví dụ: Công nghệ thông tin"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                </Field>
                <Field label="Nghề nghiệp hiện tại" icon={<Briefcase className="w-3.5 h-3.5" />}>
                  <input value={form.current_job} onChange={e => set('current_job', e.target.value)}
                    placeholder="Ví dụ: Sinh viên, Công nhân, Nông dân..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                </Field>
                <Field label="Trình độ lý luận chính trị" icon={<Award className="w-3.5 h-3.5" />}>
                  <select value={form.political_theory_level} onChange={e => set('political_theory_level', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]">
                    <option value="elementary">Sơ cấp</option>
                    <option value="intermediate">Trung cấp</option>
                    <option value="advanced">Cao cấp</option>
                    <option value="other">Khác</option>
                  </select>
                </Field>
              </>
            )}

            {/* BƯỚC 3 */}
            {step === 3 && (
              <>
                <Field label="Tôn giáo" icon={<Church className="w-3.5 h-3.5" />}>
                  <input value={form.religion} onChange={e => set('religion', e.target.value)}
                    placeholder="Không"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                </Field>
                <Field label="Dân tộc">
                  <select value={form.ethnicity_id} onChange={e => set('ethnicity_id', e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]">
                    <option value="">— Không chọn —</option>
                    {options?.ethnicities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={form.is_party_member}
                    onChange={e => set('is_party_member', e.target.checked)}
                    className="w-4 h-4 accent-[#1F5FBF]" />
                  <span className="font-semibold text-slate-700">Là Đảng viên</span>
                </label>
                <Field label="Ảnh đại diện (URL)">
                  <input value={form.avatar_url} onChange={e => set('avatar_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
                </Field>
              </>
            )}

            {/* BƯỚC 4 — XEM LẠI */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800">
                  Vui lòng đọc kỹ thông tin bên dưới. Sau khi xác nhận, hồ sơ đoàn viên sẽ được tạo và
                  <b> không sửa được các trường họ tên, ngày sinh, chi đoàn</b> — chỉ cán bộ Đoàn xã mới sửa được.
                </div>

                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
                  <Row label="Họ và tên" value={form.full_name} />
                  <Row label="Ngày sinh" value={form.birth_date ? formatDateVN(form.birth_date) : '—'} />
                  <Row label="Giới tính" value={GENDER_LABEL[form.gender] ?? form.gender} />
                  <Row label="Chi đoàn" value={unitName} />
                  <Row label="Số điện thoại" value={form.phone || '—'} />
                  <Row label="Ngày vào Đoàn" value={form.joined_date ? formatDateVN(form.joined_date) : '—'} />
                  <Row label="Học vấn" value={form.education_grade || '—'} />
                  <Row label="Chuyên môn" value={form.specialization || '—'} />
                  <Row label="Nghề nghiệp" value={form.current_job || '—'} />
                  <Row label="Lý luận chính trị" value={POLITICAL_LABEL[form.political_theory_level] ?? '—'} />
                  <Row label="Tôn giáo" value={form.religion || '—'} />
                  <Row label="Dân tộc" value={ethnicityName} />
                  <Row label="Đảng viên" value={form.is_party_member ? 'Có' : 'Không'} />
                  <Row label="Email" value={email ?? '—'} />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
                  Vai trò tài khoản: <b className="text-slate-800">Đoàn viên (member)</b>. Cán bộ Đoàn xã có thể nâng quyền sau.
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Điều hướng */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button type="button" onClick={step === 1 ? onSignOut : back}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">
                <ChevronLeft className="w-3.5 h-3.5" /> {step === 1 ? 'Đăng xuất' : 'Quay lại'}
              </button>

              {step < 4 ? (
                <button type="button" onClick={next}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg">
                  Tiếp tục <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button type="button" disabled={countdown > 0 || busy} onClick={submit}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg ${
                    countdown > 0 || busy ? 'bg-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {busy ? 'Đang tạo tài khoản…' : countdown > 0 ? `Đọc kỹ (${countdown}s)` : 'Xác nhận thông tin'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div>
    <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
      {icon}{label}
    </label>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 px-3 py-2">
    <span className="text-slate-500 shrink-0">{label}</span>
    <span className="font-semibold text-slate-800 text-right break-words">{value}</span>
  </div>
);
