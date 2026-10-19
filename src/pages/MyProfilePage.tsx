import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateVN } from '../mock/data';
import { User, Save, Loader2, Lock, Info } from 'lucide-react';
import type { PoliticalTheoryLevel } from '../types';

export const MyProfilePage: React.FC = () => {
  const { currentUser, currentMember, getUnitById, updateMyProfile, showToast } = useApp();

  const [phone, setPhone] = useState('');
  const [religion, setReligion] = useState('');
  const [job, setJob] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [theory, setTheory] = useState<PoliticalTheoryLevel>('elementary');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentMember) {
      setPhone(currentMember.phone ?? '');
      setReligion(currentMember.religion ?? '');
      setJob(currentMember.current_job ?? '');
      setSpecialization(currentMember.specialization ?? '');
      setTheory(currentMember.political_theory_level ?? 'elementary');
      setAvatarUrl(currentMember.avatar_url ?? '');
      setNote(currentMember.note ?? '');
    }
  }, [currentMember]);

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập.</div>;
  }
  if (!currentMember) {
    return <div className="p-8 text-center text-slate-500">Tài khoản chưa gắn với hồ sơ đoàn viên.</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await updateMyProfile({
      phone, religion, current_job: job, specialization,
      political_theory_level: theory, avatar_url: avatarUrl, note,
    });
    setBusy(false);
    if (res.success) {
      showToast({ title: 'Đã lưu hồ sơ', type: 'success' });
    } else {
      showToast({ title: 'Không lưu được', description: res.message, type: 'error' });
    }
  };

  const unit = getUnitById(currentMember.unit_id);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <User className="w-6 h-6 text-[#1F5FBF]" />
          Hồ sơ của tôi
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          Bạn có thể tự cập nhật một số thông tin cá nhân.
        </p>
      </div>

      {/* Thông tin không được tự sửa */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-slate-400" /> Thông tin do cán bộ Đoàn xã quản lý
        </p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-slate-500">Họ tên:</span> <b className="text-slate-800">{currentMember.full_name}</b></div>
          <div><span className="text-slate-500">Ngày sinh:</span> <b className="text-slate-800">{formatDateVN(currentMember.birth_date)}</b></div>
          <div><span className="text-slate-500">Chi đoàn:</span> <b className="text-slate-800">{unit?.name ?? '—'}</b></div>
          <div><span className="text-slate-500">Chức vụ:</span> <b className="text-slate-800">{
            currentMember.current_position === 'secretary' ? 'Bí thư'
            : currentMember.current_position === 'deputy_secretary' ? 'Phó bí thư' : 'Đoàn viên'}</b></div>
          <div><span className="text-slate-500">Ngày vào Đoàn:</span> <b className="text-slate-800">{formatDateVN(currentMember.joined_date)}</b></div>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Info className="w-3 h-3" /> Cần sửa các thông tin này? Liên hệ cán bộ Đoàn xã.
        </p>
      </div>

      {/* Form sửa thông tin an toàn */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-800 block mb-1">Số điện thoại:</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
          </div>
          <div>
            <label className="font-bold text-slate-800 block mb-1">Tôn giáo:</label>
            <input type="text" value={religion} onChange={e => setReligion(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
          </div>
          <div>
            <label className="font-bold text-slate-800 block mb-1">Nghề nghiệp hiện tại:</label>
            <input type="text" value={job} onChange={e => setJob(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
          </div>
          <div>
            <label className="font-bold text-slate-800 block mb-1">Chuyên môn:</label>
            <input type="text" value={specialization} onChange={e => setSpecialization(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
          </div>
          <div>
            <label className="font-bold text-slate-800 block mb-1">Trình độ lý luận chính trị:</label>
            <select value={theory} onChange={e => setTheory(e.target.value as PoliticalTheoryLevel)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]">
              <option value="elementary">Sơ cấp</option>
              <option value="intermediate">Trung cấp</option>
              <option value="advanced">Cao cấp</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-800 block mb-1">Ảnh đại diện (URL):</label>
            <input type="text" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
          </div>
        </div>
        <div>
          <label className="font-bold text-slate-800 block mb-1">Ghi chú:</label>
          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg resize-none focus:outline-none focus:border-[#1F5FBF]" />
        </div>

        <div className="pt-2">
          <button type="submit" disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu thay đổi
          </button>
        </div>
      </form>
    </div>
  );
};
