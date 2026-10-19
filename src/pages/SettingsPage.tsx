import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Sliders,
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Edit2,
  Building2,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { UnitTypeId } from '../types';

export const SettingsPage: React.FC = () => {
  const {
    yearlySettings,
    selectedYear,
    setSelectedYear,
    unitTypes,
    criteriaSet,
    criteriaSets,
    setActiveCriteriaSet,
    createUnitType,
    updateUnitType,
    deleteUnitType,
    updateYearlySettings,
    showToast,
  } = useApp();

  const [target, setTarget] = useState(yearlySettings.new_member_target);
  const [maturedAge, setMaturedAge] = useState(yearlySettings.matured_age);
  const [reminderMilestones, setReminderMilestones] = useState('7, 3, 1');
  const [maxPhotos, setMaxPhotos] = useState(yearlySettings.max_photos ?? 3);
  const [maxFiles, setMaxFiles] = useState(yearlySettings.max_files ?? 3);
  const [maxLinks, setMaxLinks] = useState(yearlySettings.max_links ?? 5);
  const [requireGps, setRequireGps] = useState(yearlySettings.require_gps ?? true);
  const [criteriaSetId, setCriteriaSetId] = useState(yearlySettings.criteria_set_id ?? '');

  // Đồng bộ form khi dữ liệu năm đổi
  React.useEffect(() => {
    setTarget(yearlySettings.new_member_target);
    setMaturedAge(yearlySettings.matured_age);
    setMaxPhotos(yearlySettings.max_photos ?? 3);
    setMaxFiles(yearlySettings.max_files ?? 3);
    setMaxLinks(yearlySettings.max_links ?? 5);
    setRequireGps(yearlySettings.require_gps ?? true);
    setCriteriaSetId(yearlySettings.criteria_set_id ?? '');
  }, [yearlySettings]);

  // Quản lý loại chi đoàn
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState<UnitTypeId | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');

  const handleSaveYearly = (e: React.FormEvent) => {
    e.preventDefault();
    updateYearlySettings({
      new_member_target: Number(target),
      matured_age: Number(maturedAge),
      max_photos: Number(maxPhotos),
      max_files: Number(maxFiles),
      max_links: Number(maxLinks),
      require_gps: requireGps,
      criteria_set_id: criteriaSetId,
    });
    // Đồng bộ bộ đang soạn ở trang Tiêu chí theo bộ mặc định vừa chọn
    if (criteriaSetId) setActiveCriteriaSet(criteriaSetId);

    showToast({
      title: 'Đã lưu cấu hình năm',
      description: `Chỉ tiêu kết nạp: ${target} • Tuổi trưởng thành: ${maturedAge} • Ảnh tối đa: ${maxPhotos}${requireGps ? ' • Bắt buộc GPS' : ''}.`,
      type: 'success',
    });
  };

  const handleAddUnitType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    createUnitType(newTypeName.trim());
    setNewTypeName('');
  };

  const handleSaveUnitType = (id: UnitTypeId) => {
    if (!editingTypeName.trim()) return;
    updateUnitType(id, editingTypeName.trim());
    setEditingTypeId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
          <Sliders className="w-6 h-6 text-[#1F5FBF]" />
          Cấu hình Hệ thống & Tham số Nghiệp vụ
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          Thiết lập các tham số niên độ, chỉ tiêu thi đua, tuổi đoàn viên và danh mục loại chi đoàn
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* KHỐI 1: CẤU HÌNH NIÊN ĐỘ LÀM VIỆC */}
        <form onSubmit={handleSaveYearly} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#1F5FBF]" />
              Tham số Niên độ Làm việc
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-[#1F5FBF]">
              Năm {selectedYear}
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Năm công tác hiện tại:
            </label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-bold text-[#1F5FBF]"
            >
              <option value={2026}>Năm 2026 (Mặc định)</option>
              <option value={2025}>Năm 2025 (Niên độ trước)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Chỉ tiêu phát triển đoàn viên mới trong năm:
            </label>
            <input
              type="number"
              min={1}
              value={target}
              onChange={e => setTarget(Number(e.target.value))}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF] font-semibold text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Chỉ tiêu Huyện Đoàn giao cho Đoàn xã Hòa Bình trong năm {selectedYear}.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Độ tuổi làm lễ Trưởng thành Đoàn (tuổi):
            </label>
            <input
              type="number"
              min={18}
              max={35}
              value={maturedAge}
              onChange={e => setMaturedAge(Number(e.target.value))}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF] font-semibold text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Quy định theo Điều lệ Đoàn TNCS Hồ Chí Minh (mặc định 30 tuổi). Tự động tính toán trạng thái "Đã trưởng thành" của đoàn viên.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Mốc nhắc việc tự động (ngày trước hạn):
            </label>
            <input
              type="text"
              value={reminderMilestones}
              onChange={e => setReminderMilestones(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Mặc định: 7, 3, 1 ngày trước thời hạn chót của nhiệm vụ và tiêu chí.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Bộ Tiêu chí áp dụng:
            </label>
            <select
              value={criteriaSetId}
              onChange={e => setCriteriaSetId(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:border-[#1F5FBF]"
            >
              <option value="">— Chưa chọn bộ tiêu chí —</option>
              {criteriaSets.find(cs => cs.id === criteriaSetId)?.archived_at && (
                <option value={criteriaSetId}>
                  {criteriaSets.find(cs => cs.id === criteriaSetId)?.name} (đã lưu trữ)
                </option>
              )}
              {criteriaSets.filter(cs => !cs.archived_at).map(cs => (
                <option key={cs.id} value={cs.id}>
                  {cs.name} (năm {cs.year})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Bộ tiêu chí mặc định cho năm {selectedYear}. Chi đoàn chỉ thấy và chấm các tiêu chí trong bộ này.
            </p>
            {criteriaSetId && criteriaSets.find(cs => cs.id === criteriaSetId)?.archived_at && (
              <p className="text-[11px] text-rose-600 font-semibold mt-1">
                Bộ đang chọn đã bị lưu trữ. Chi đoàn sẽ không thấy tiêu chí nào để chấm — hãy chọn bộ khác hoặc khôi phục bộ này.
              </p>
            )}
          </div>

          {/* CẤU HÌNH MINH CHỨNG */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#1F5FBF]" /> Cấu hình Minh chứng
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Ảnh tối đa:</label>
                <input type="number" min={1} max={20} value={maxPhotos}
                  onChange={e => setMaxPhotos(Number(e.target.value))}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Tệp tối đa:</label>
                <input type="number" min={0} max={20} value={maxFiles}
                  onChange={e => setMaxFiles(Number(e.target.value))}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Link tối đa:</label>
                <input type="number" min={0} max={20} value={maxLinks}
                  onChange={e => setMaxLinks(Number(e.target.value))}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold" />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={requireGps} onChange={e => setRequireGps(e.target.checked)}
                className="w-4 h-4 text-[#1F5FBF] rounded" />
              <span className="text-xs text-slate-700 font-medium">Bắt buộc ảnh minh chứng có toạ độ GPS</span>
            </label>
            <p className="text-[11px] text-slate-400">
              Áp dụng cho cán bộ (bí thư, phó bí thư chi đoàn) khi nộp minh chứng.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" /> Lưu cấu hình niên độ
            </button>
          </div>
        </form>

        {/* KHỐI 2: QUẢN LÝ DANH MỤC LOẠI CHI ĐOÀN */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1F5FBF]" />
              Danh mục Loại Chi đoàn ({unitTypes.length})
            </h2>
          </div>

          <p className="text-xs text-slate-500">
            Phân loại chi đoàn để giao chỉ tiêu và tiêu chí phù hợp với đặc thù địa bàn.
          </p>

          {/* Form thêm loại mới */}
          <form onSubmit={handleAddUnitType} className="flex gap-2">
            <input
              type="text"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              placeholder="Tên loại chi đoàn mới..."
              className="flex-1 p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Thêm
            </button>
          </form>

          {/* Danh sách loại chi đoàn */}
          <div className="space-y-2 pt-2">
            {unitTypes.map(ut => {
              const isEditing = editingTypeId === ut.id;

              return (
                <div
                  key={ut.id}
                  className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  {isEditing ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={editingTypeName}
                        onChange={e => setEditingTypeName(e.target.value)}
                        className="flex-1 p-1.5 text-xs bg-white border border-slate-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveUnitType(ut.id)}
                        className="px-2 py-1 text-xs font-bold text-white bg-[#1F5FBF] rounded"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTypeId(null)}
                        className="px-2 py-1 text-xs text-slate-600 bg-slate-200 rounded"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <>
                      <div>
                        <strong className="text-xs text-slate-900 block">{ut.name}</strong>
                        <span className="text-[10px] text-slate-400 font-mono">Mã: {ut.id}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTypeId(ut.id);
                            setEditingTypeName(ut.name);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded"
                          title="Sửa tên"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUnitType(ut.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-100 rounded"
                          title="Xóa loại"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
