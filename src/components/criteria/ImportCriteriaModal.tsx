import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  parseCriteriaWorkbook,
  toImportPayload,
  type ParsedCriteriaTree,
} from '../../utils/criteriaImport';
import {
  FileSpreadsheet,
  Upload,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Award,
  ChevronRight,
} from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Gọi sau khi nhập thành công để trang cha chuyển sang bộ vừa tạo. */
  onImported?: (criteriaSetId: string) => void;
}

type Step = 1 | 2 | 3;

export const ImportCriteriaModal: React.FC<Props> = ({ open, onClose, onImported }) => {
  const { importCriteriaTree, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [tree, setTree] = useState<ParsedCriteriaTree | null>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cho phép sửa tên bộ / năm trước khi áp dụng
  const [setName, setSetName] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());

  if (!open) return null;

  const reset = () => {
    setStep(1);
    setTree(null);
    setFileName('');
    setError(null);
    setSetName('');
    setYear(new Date().getFullYear());
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = await parseCriteriaWorkbook(buf);
      setTree(parsed);
      setSetName(parsed.setName);
      setYear(parsed.year);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được file.');
      setTree(null);
    } finally {
      setParsing(false);
    }
  };

  const handleApply = async () => {
    if (!tree) return;
    setApplying(true);
    try {
      const payload = toImportPayload(tree, { setName: setName.trim() || tree.setName, year });
      const res = await importCriteriaTree(payload);
      if (res.success && res.criteriaSetId) {
        showToast({
          title: 'Đã nhập bộ tiêu chí',
          description: `${payload.sections.length} phần • ${payload.criteria.length} tiêu chí • ${payload.subCriteria.length} điều kiện`,
          type: 'success',
        });
        onImported?.(res.criteriaSetId);
        handleClose();
      } else {
        showToast({ title: 'Không thể nhập', description: res.message || 'Vui lòng thử lại', type: 'error' });
      }
    } catch (err) {
      showToast({
        title: 'Không thể nhập',
        description: err instanceof Error ? err.message : 'Vui lòng thử lại',
        type: 'error',
      });
    } finally {
      setApplying(false);
    }
  };

  const sectionPoints = (si: number) =>
    tree?.sections[si].criteria.reduce((t, c) => t + c.subs.reduce((u, s) => u + s.max_score, 0), 0) ?? 0;
  const criterionPoints = (si: number, ci: number) =>
    tree?.sections[si].criteria[ci].subs.reduce((u, s) => u + s.max_score, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#1F5FBF]" />
              Nhập Bộ Tiêu chí từ Excel
            </h3>
            <p className="text-xs text-slate-500">Bước {step}/3</p>
          </div>
          <button type="button" onClick={handleClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 bg-slate-100 text-center text-xs font-semibold border-b border-slate-200">
          {(['1. Chọn file', '2. Xem trước', '3. Xác nhận'] as const).map((label, i) => (
            <div
              key={label}
              className={`py-2 border-b-2 ${
                step >= i + 1 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'text-slate-400'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
          {/* STEP 1: chọn file */}
          {step === 1 && (
            <div className="text-center space-y-4 py-6">
              <FileSpreadsheet className="w-12 h-12 text-emerald-600 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Chọn file Bộ Tiêu chí (.xlsx)</h4>
                <p className="text-slate-500 max-w-md mx-auto mt-1">
                  Chọn đúng file bộ tiêu chí do Tỉnh đoàn ban hành. Hệ thống sẽ tự nhận diện các Phần,
                  Tiêu chí và điều kiện chấm điểm.
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={parsing}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer disabled:opacity-60"
              >
                {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {parsing ? 'Đang đọc file…' : 'Chọn file Excel'}
              </button>

              {error && (
                <div className="flex items-start gap-2 text-left text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 max-w-md mx-auto">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: xem trước */}
          {step === 2 && tree && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Đã đọc <b>{fileName}</b> — {tree.totals.sections} phần, {tree.totals.criteria} tiêu chí,{' '}
                  {tree.totals.subs} điều kiện, tổng <b>{tree.totals.points} điểm</b>.
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Tên bộ tiêu chí</label>
                  <input
                    type="text"
                    value={setName}
                    onChange={e => setSetName(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Năm áp dụng</label>
                  <input
                    type="number"
                    value={year}
                    onChange={e => setYear(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>
              </div>

              {tree.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="font-bold text-amber-800 flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="w-4 h-4" /> {tree.warnings.length} cảnh báo
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5 text-amber-800 max-h-32 overflow-y-auto">
                    {tree.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cây xem trước */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {tree.sections.map((sec, si) => (
                  <div key={si} className="border-b border-slate-100 last:border-b-0">
                    <div className="bg-slate-50 px-3 py-2 font-bold text-slate-800 flex items-center justify-between">
                      <span className="line-clamp-1">{sec.name}</span>
                      <span className="text-[#1F5FBF] shrink-0 ml-2">{sectionPoints(si)}đ</span>
                    </div>
                    {sec.criteria.map((crit, ci) => (
                      <div key={ci} className="pl-4">
                        <div className="px-3 py-1.5 text-slate-700 font-semibold flex items-center justify-between border-t border-slate-50">
                          <span className="line-clamp-1">{crit.name}</span>
                          <span className="text-slate-500 shrink-0 ml-2">{criterionPoints(si, ci)}đ</span>
                        </div>
                        <ul className="pl-6 pb-1">
                          {crit.subs.map((sub, bi) => (
                            <li key={bi} className="py-1 flex items-start justify-between gap-2 text-slate-600 border-t border-slate-50">
                              <span className="line-clamp-2 flex-1">{sub.condition_text}</span>
                              <span className="shrink-0 font-bold text-slate-700">{sub.max_score}đ</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: xác nhận */}
          {step === 3 && tree && (
            <div className="space-y-4 py-4">
              <div className="text-center space-y-2">
                <Award className="w-12 h-12 text-[#1F5FBF] mx-auto" />
                <h4 className="text-sm font-bold text-slate-900">Xác nhận nhập bộ tiêu chí</h4>
                <p className="text-slate-600 max-w-md mx-auto">
                  Bộ tiêu chí mới sẽ được <b>tạo riêng</b> (không ghi đè bộ hiện có):
                </p>
              </div>
              <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">Tên bộ:</span><span className="font-semibold text-right">{setName}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Năm:</span><span className="font-bold">{year}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số Phần:</span><span className="font-bold">{tree.totals.sections}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số Tiêu chí:</span><span className="font-bold">{tree.totals.criteria}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Số điều kiện:</span><span className="font-bold">{tree.totals.subs}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5"><span className="text-slate-500">Tổng điểm:</span><span className="font-bold text-[#1F5FBF]">{tree.totals.points}đ</span></div>
              </div>
              <p className="text-center text-slate-500">
                Sau khi nhập, bạn có thể chỉnh sửa trực tiếp trong trang soạn thảo.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={handleClose}
            className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg cursor-pointer"
          >
            Hủy
          </button>
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
              >
                Tiếp tục <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  disabled={applying}
                  onClick={handleApply}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {applying ? 'Đang nhập…' : 'Nhập bộ tiêu chí'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
