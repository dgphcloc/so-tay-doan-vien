import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Loader2, Check, Search } from 'lucide-react';

/**
 * Gắn tiêu chí đóng góp cho một nhiệm vụ ĐÃ TẠO.
 * Chỉ chọn được tiêu chí con thuộc bộ tiêu chí đang chốt cho năm.
 */
export const TaskCriteriaModal: React.FC<{
  taskId: string;
  onClose: () => void;
}> = ({ taskId, onClose }) => {
  const {
    criteriaSets, criteriaSections, criteria, subCriteria, taskSubCriteria,
    yearlySettings, saveTaskSubCriteria, showToast,
  } = useApp();

  const [selected, setSelected] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  // Nạp lựa chọn hiện tại
  useEffect(() => {
    const current: Record<string, number> = {};
    for (const t of taskSubCriteria.filter(x => x.task_id === taskId)) {
      current[t.sub_criterion_id] = t.contribution_score;
    }
    setSelected(current);
  }, [taskId, taskSubCriteria]);

  // Tiêu chí của bộ đang chốt cho năm
  const currentSet = useMemo(
    () => criteriaSets.find(s => s.id === yearlySettings.criteria_set_id && !s.archived_at) ?? null,
    [criteriaSets, yearlySettings.criteria_set_id]
  );

  const sectionsOfSet = useMemo(
    () => (currentSet ? criteriaSections.filter(s => s.criteria_set_id === currentSet.id) : []),
    [criteriaSections, currentSet]
  );
  const criteriaOfSet = useMemo(() => {
    const ids = new Set(sectionsOfSet.map(s => s.id));
    return criteria.filter(c => ids.has(c.section_id));
  }, [criteria, sectionsOfSet]);
  const subsOfSet = useMemo(() => {
    const ids = new Set(criteriaOfSet.map(c => c.id));
    return subCriteria.filter(sc => ids.has(sc.criterion_id));
  }, [subCriteria, criteriaOfSet]);

  // Nhóm theo Phần → Tiêu chí, lọc theo ô tìm kiếm
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sectionsOfSet.map(sec => {
      const crits = criteriaOfSet
        .filter(c => c.section_id === sec.id)
        .map(c => ({
          criterion: c,
          subs: subsOfSet.filter(sc => {
            if (sc.criterion_id !== c.id) return false;
            if (!q) return true;
            return sc.condition_text.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
          }),
        }))
        .filter(x => x.subs.length > 0);
      return { section: sec, criteria: crits };
    }).filter(g => g.criteria.length > 0);
  }, [sectionsOfSet, criteriaOfSet, subsOfSet, search]);

  const totalSelected = Object.keys(selected).length;

  const toggle = (id: string, maxScore: number) => {
    setSelected(prev => {
      const next = { ...prev };
      if (next[id] !== undefined) delete next[id];
      else next[id] = maxScore;
      return next;
    });
  };

  const setScore = (id: string, value: number) => {
    setSelected(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const items = Object.entries(selected).map(([sub_criterion_id, contribution_score]) => ({
        sub_criterion_id, contribution_score,
      }));
      const res = await saveTaskSubCriteria(taskId, items);
      if (res.success) {
        showToast({ title: 'Đã lưu tiêu chí cho nhiệm vụ', description: `${items.length} tiêu chí được gắn.`, type: 'success' });
        onClose();
      } else {
        showToast({ title: 'Không lưu được', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Gắn tiêu chí cho nhiệm vụ</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {currentSet
                ? `Bộ đang chốt: ${currentSet.name}`
                : 'Chưa chọn bộ tiêu chí mặc định — vào Cấu hình để chọn trước.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!currentSet ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Chưa có bộ tiêu chí nào được chốt cho năm. Vào trang Cấu hình chọn bộ tiêu chí mặc định trước.
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm tiêu chí..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {grouped.length === 0 && (
                <p className="p-6 text-center text-slate-400">Không có tiêu chí nào khớp tìm kiếm.</p>
              )}
              {grouped.map(({ section, criteria: crits }) => (
                <div key={section.id} className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase text-slate-500">
                    Phần {section.stt}. {section.name}
                  </p>
                  {crits.map(({ criterion, subs }) => (
                    <div key={criterion.id} className="border border-slate-200 rounded-lg overflow-hidden">
                      <p className="px-2.5 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-700">
                        {criterion.stt}. {criterion.name}
                      </p>
                      <div className="divide-y divide-slate-100">
                        {subs.map(sc => {
                          const checked = selected[sc.id] !== undefined;
                          return (
                            <div key={sc.id} className={`p-2.5 flex items-start gap-2 ${checked ? 'bg-blue-50/40' : ''}`}>
                              <button
                                type="button"
                                onClick={() => toggle(sc.id, sc.max_score)}
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                  checked ? 'bg-[#1F5FBF] border-[#1F5FBF] text-white' : 'border-slate-300 bg-white'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-800 leading-snug">{sc.condition_text}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Tối đa {sc.max_score} điểm</p>
                              </div>
                              {checked && (
                                <input
                                  type="number" min={0} max={sc.max_score}
                                  value={selected[sc.id]}
                                  onChange={e => setScore(sc.id, Number(e.target.value))}
                                  onClick={e => e.stopPropagation()}
                                  className="w-16 p-1 text-xs text-center bg-white border border-slate-300 rounded font-bold text-[#1F5FBF]"
                                  title="Điểm đóng góp"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Đã chọn <b className="text-[#1F5FBF]">{totalSelected}</b> tiêu chí</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Huỷ</button>
                <button type="button" disabled={busy} onClick={handleSave}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Lưu tiêu chí
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
