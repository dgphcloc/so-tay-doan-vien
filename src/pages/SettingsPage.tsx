import React, { useState, useRef } from 'react';
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
  Download,
  Upload,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  RotateCcw,
  MapPin,
  X,
} from 'lucide-react';
import { UnitTypeId } from '../types';
import {
  exportSettingsCatalogExcel,
  downloadUnitTypeTemplate,
  parseUnitTypesWorkbook,
} from '../utils/settingsCatalogExcel';

export const SettingsPage: React.FC = () => {
  const {
    yearlySettings,
    selectedYear,
    setSelectedYear,
    unitTypes,
    ethnicities,
    criteriaSet,
    criteriaSets,
    setActiveCriteriaSet,
    createUnitType,
    updateUnitType,
    deleteUnitType,
    updateYearlySettings,
    showToast,
    currentRole,
    resetFactoryData,
  } = useApp();

  const canResetData = currentRole === 'super_admin' || currentRole === 'admin';
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportingTypes, setIsImportingTypes] = useState(false);

  const [target, setTarget] = useState(yearlySettings.new_member_target);
  const [maturedAge, setMaturedAge] = useState(yearlySettings.matured_age);
  const [reminderMilestones, setReminderMilestones] = useState('7, 3, 1');
  const [maxPhotos, setMaxPhotos] = useState(yearlySettings.max_photos ?? 3);
  const [maxFiles, setMaxFiles] = useState(yearlySettings.max_files ?? 3);
  const [maxLinks, setMaxLinks] = useState(yearlySettings.max_links ?? 5);
  const [requireGps, setRequireGps] = useState(yearlySettings.require_gps ?? true);
  const [criteriaSetId, setCriteriaSetId] = useState(yearlySettings.criteria_set_id ?? '');
  // Cấu hình điểm danh
  const [defaultRadius, setDefaultRadius] = useState(yearlySettings.default_radius_m ?? 100);
  const [maxAccuracy, setMaxAccuracy] = useState(yearlySettings.max_accuracy_m ?? 100);

  // Đồng bộ form khi dữ liệu năm đổi
  React.useEffect(() => {
    setTarget(yearlySettings.new_member_target);
    setMaturedAge(yearlySettings.matured_age);
    setMaxPhotos(yearlySettings.max_photos ?? 3);
    setMaxFiles(yearlySettings.max_files ?? 3);
    setMaxLinks(yearlySettings.max_links ?? 5);
    setRequireGps(yearlySettings.require_gps ?? true);
    setCriteriaSetId(yearlySettings.criteria_set_id ?? '');
    setDefaultRadius(yearlySettings.default_radius_m ?? 100);
    setMaxAccuracy(yearlySettings.max_accuracy_m ?? 100);
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
      default_radius_m: Number(defaultRadius),
      max_accuracy_m: Number(maxAccuracy),
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

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#1F5FBF]" /> Cấu hình Điểm danh
            </h3>
            <p className="text-[11px] text-slate-500">
              Áp dụng khi nhiệm vụ có đặt toạ độ. Khoảng cách được hệ thống tính khi đoàn viên nộp minh chứng.
              Nhiệm vụ có thể đặt bán kính riêng, ghi đè giá trị dưới đây.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Bán kính mặc định (m):
                </label>
                <input type="number" min={20} max={1000} step={10} value={defaultRadius}
                  onChange={e => setDefaultRadius(Number(e.target.value))}
                  title="Khoảng cách tối đa để một lượt nộp được coi là trong phạm vi. Cho phép 20–1000 m."
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold" />
                <p className="text-[10px] text-slate-400 mt-0.5">Cho phép 20 – 1000 m</p>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Sai số GPS tối đa (m):
                </label>
                <input type="number" min={5} max={500} step={5} value={maxAccuracy}
                  onChange={e => setMaxAccuracy(Number(e.target.value))}
                  title="Ảnh có sai số GPS lớn hơn ngưỡng này sẽ bị gắn nhãn 'Độ chính xác kém'. Cho phép 5–500 m."
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold" />
                <p className="text-[10px] text-slate-400 mt-0.5">Cho phép 5 – 500 m</p>
              </div>
            </div>

            {(defaultRadius < 20 || defaultRadius > 1000) && (
              <p className="text-[11px] text-rose-600 font-semibold">Bán kính phải trong khoảng 20–1000 m.</p>
            )}
            {(maxAccuracy < 5 || maxAccuracy > 500) && (
              <p className="text-[11px] text-rose-600 font-semibold">Sai số phải trong khoảng 5–500 m.</p>
            )}
          </div>

          <div className="pt-2">
            <button title="Lưu cấu hình niên độ"
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" /> Lưu cấu hình niên độ
            </button>
          </div>
        </form>

        {/* KHỐI 2: QUẢN LÝ DANH MỤC LOẠI CHI ĐOÀN */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#1F5FBF]" />
              Danh mục Loại Chi đoàn ({unitTypes.length})
            </h2>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  exportSettingsCatalogExcel(unitTypes, ethnicities);
                  showToast({ title: 'Đã xuất file Excel danh mục', description: 'Gồm 2 sheet: Loại chi đoàn & Dân tộc', type: 'success' });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
                title="Xuất file Excel gồm 2 sheet: Loại chi đoàn & Dân tộc"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" /> Xuất danh mục
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setIsImportingTypes(true);
                    const buf = await f.arrayBuffer();
                    const names = await parseUnitTypesWorkbook(buf);
                    let added = 0;
                    for (const name of names) {
                      await createUnitType(name);
                      added++;
                    }
                    showToast({ title: 'Nhập loại chi đoàn thành công!', description: `Đã nạp ${added} loại chi đoàn từ Excel.`, type: 'success' });
                  } catch (err) {
                    showToast({ title: 'Không nạp được file', description: err instanceof Error ? err.message : '', type: 'error' });
                  } finally {
                    setIsImportingTypes(false);
                    e.target.value = '';
                  }
                }}
              />

              <button
                type="button"
                disabled={isImportingTypes}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed"
                title="Nhập thêm loại chi đoàn từ file Excel"
              >
                {isImportingTypes ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1F5FBF]" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-[#1F5FBF]" />
                )}
                {isImportingTypes ? 'Đang nạp…' : 'Nhập Excel'}
              </button>

              <button
                type="button"
                onClick={downloadUnitTypeTemplate}
                className="inline-flex items-center p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Tải file mẫu nhập loại chi đoàn"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
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
            <button title="Thêm"
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
                      <button title="Lưu"
                        type="button"
                        onClick={() => handleSaveUnitType(ut.id)}
                        className="px-2 py-1 text-xs font-bold text-white bg-[#1F5FBF] rounded"
                      >
                        Lưu
                      </button>
                      <button title="Hủy"
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

        {/* ================= QUẢN TRỊ VIÊN: KHÔI PHỤC CÀI ĐẶT GỐC ================= */}
        {canResetData && (
          <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  Đóng gói phần mềm & Khôi phục cài đặt gốc
                </h3>
                <p className="text-xs text-rose-700/80 mt-0.5">
                  Xóa toàn bộ dữ liệu thử nghiệm (nhiệm vụ, minh chứng, bài nộp, đoàn phí, xếp loại, đoàn viên test...) để bàn giao hệ thống trắng cho đơn vị mới.
                </p>
              </div>

              <button title="Dọn sạch dữ liệu thử nghiệm"
                type="button"
                onClick={() => {
                  setResetConfirmText('');
                  setIsResetModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs cursor-pointer shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Dọn sạch dữ liệu thử nghiệm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: XÁC NHẬN AN TOÀN KHÔI PHỤC GỐC */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Cảnh báo: Khôi phục cài đặt gốc
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Thao tác này sẽ xóa vĩnh viễn dữ liệu thử nghiệm</p>
              </div>
              <button title="Đóng" type="button" onClick={() => setIsResetModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700">
              <p>
                Toàn bộ dữ liệu phát sinh sau sẽ bị dọn sạch:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <li>Nhiệm vụ, Minh chứng, Bài nộp cá nhân, Bài nộp chi đoàn</li>
                <li>Bộ tiêu chí con, Bài tự chấm, Điểm thi đua</li>
                <li>Dữ liệu Thu nộp Đoàn phí & Lịch trích nộp 2/3 - 1/3</li>
                <li>Phiếu Đánh giá, xếp loại đoàn viên & chi đoàn</li>
                <li>Toàn bộ thông báo, lời nhắc, báo cáo và sổ tay</li>
                <li>Các đoàn viên và chi đoàn thử nghiệm</li>
              </ul>
              <p className="text-emerald-700 font-semibold text-[11px]">
                ✓ Tài khoản Admin hiện tại và danh mục 54 Dân tộc, 5 Vai trò gốc sẽ được giữ lại nguyên vẹn.
              </p>

              <div className="pt-2 border-t border-slate-100">
                <label className="text-[11px] font-bold text-slate-800 block mb-1">
                  Để xác nhận, gõ chính xác: <strong className="text-rose-600 select-all font-mono">XOA TOAN BO DU LIEU</strong>
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={e => setResetConfirmText(e.target.value)}
                  placeholder="XOA TOAN BO DU LIEU"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button title="Hủy"
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button title="Xác nhận xóa & Làm sạch"
                type="button"
                disabled={resetConfirmText !== 'XOA TOAN BO DU LIEU' || isResetting}
                onClick={async () => {
                  setIsResetting(true);
                  try {
                    const res = await resetFactoryData(resetConfirmText);
                    if (res.success) {
                      showToast({ title: 'Đã dọn sạch database thử nghiệm thành công!', type: 'success' });
                      setIsResetModalOpen(false);
                    } else {
                      showToast({ title: 'Không thể khôi phục', description: res.message, type: 'error' });
                    }
                  } catch (err) {
                    showToast({ title: 'Có lỗi xảy ra', description: err instanceof Error ? err.message : '', type: 'error' });
                  } finally {
                    setIsResetting(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận xóa & Làm sạch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
