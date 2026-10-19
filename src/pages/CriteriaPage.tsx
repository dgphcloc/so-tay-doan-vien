import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  BookOpen,
  Copy,
  Plus,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCheck2,
  Save,
  Check,
  Building2,
  Sliders,
  Layers,
  X,
  Upload,
  Archive,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { CriteriaSection, Criterion, SubCriterion, UnitTypeId } from '../types';
import { formatDateVN } from '../mock/data';
import { DeadlineWarningBadge } from '../components/common/StatusBadge';
import { ImportCriteriaModal } from '../components/criteria/ImportCriteriaModal';
import {
  normalizeScope,
  describeAssignment,
  isSubCriterionApplicableToUnit,
  unitTypeLabel,
} from '../utils/criteriaAssignment';

export const CriteriaPage: React.FC = () => {
  const {
    criteriaSet,
    criteriaSets,
    criteriaSections,
    criteria,
    subCriteria,
    criterionSubmissions,
    units,
    yearlySettings,
    selectedYear,
    createCriteriaSection,
    updateCriteriaSection,
    deleteCriteriaSection,
    createCriterion,
    updateCriterion,
    deleteCriterion,
    createSubCriterion,
    updateSubCriterion,
    deleteSubCriterion,
    reorderSections,
    reorderCriteria,
    reorderSubCriteria,
    cloneCriteriaSetFromPreviousYear,
    deleteCriteriaSet,
    restoreCriteriaSet,
    getCriteriaSetImpact,
    purgeCriteriaSet,
    currentRole,
    setActiveCriteriaSet,
    updateYearlySettings,
    getUnitById,
    showToast,
  } = useApp();

  const navigate = useNavigate();
  // Xóa vĩnh viễn chỉ admin/super_admin thấy
  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin';

  // Top tabs: "Soạn thảo Bộ tiêu chí" vs "Tiến độ chấm (Ma trận)"
  const [activeTab, setActiveTab] = useState<'editor' | 'matrix'>('editor');

  // Chỉ hiển thị cây của BỘ TIÊU CHÍ ĐANG CHỌN (tránh trộn nhiều bộ)
  const activeSections = useMemo(
    () => criteriaSections.filter(s => s.criteria_set_id === criteriaSet.id),
    [criteriaSections, criteriaSet.id]
  );
  const activeSectionIds = useMemo(() => new Set(activeSections.map(s => s.id)), [activeSections]);
  const activeCriteria = useMemo(
    () => criteria.filter(c => activeSectionIds.has(c.section_id)),
    [criteria, activeSectionIds]
  );
  const activeCriteriaIds = useMemo(() => new Set(activeCriteria.map(c => c.id)), [activeCriteria]);
  const activeSubCriteria = useMemo(
    () => subCriteria.filter(sc => activeCriteriaIds.has(sc.criterion_id)),
    [subCriteria, activeCriteriaIds]
  );

  /** Số tiêu chí con + số bài tiêu chí đã duyệt của TỪNG bộ (không hard-code). */
  const setStats = useMemo(() => {
    const map = new Map<string, { subCount: number; approvedCount: number }>();
    for (const set of criteriaSets) {
      const sectionIds = new Set(
        criteriaSections.filter(sec => sec.criteria_set_id === set.id).map(sec => sec.id)
      );
      const critIds = new Set(
        criteria.filter(c => sectionIds.has(c.section_id)).map(c => c.id)
      );
      const subIds = new Set(
        subCriteria.filter(sc => critIds.has(sc.criterion_id)).map(sc => sc.id)
      );
      map.set(set.id, {
        subCount: subIds.size,
        approvedCount: criterionSubmissions.filter(cs => cs.status === 'approved' && subIds.has(cs.sub_criterion_id)).length,
      });
    }
    return map;
  }, [criteriaSets, criteriaSections, criteria, subCriteria, criterionSubmissions]);

  // Lưu trữ bộ tiêu chí (mặc định) — ẩn khỏi danh sách, giữ điểm + minh chứng
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);
  const [archiving, setArchiving] = useState(false);

  const handleArchiveCriteriaSet = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      const res = await deleteCriteriaSet(archiveTarget.id);
      if (res.success) {
        showToast({
          title: 'Đã lưu trữ bộ tiêu chí',
          description: 'Bộ bị ẩn khỏi danh sách. Điểm và minh chứng vẫn giữ, khôi phục được bất cứ lúc nào.',
          type: 'success',
        });
        setArchiveTarget(null);
      } else {
        showToast({ title: 'Không lưu trữ được', description: res.message, type: 'error' });
      }
    } finally {
      setArchiving(false);
    }
  };

  // Xóa vĩnh viễn: chỉ admin, hiện số liệu ảnh hưởng, gõ tên, snapshot trước khi xóa
  const [purgeTarget, setPurgeTarget] = useState<{ id: string; name: string } | null>(null);
  const [purgeConfirmName, setPurgeConfirmName] = useState('');
  const [purging, setPurging] = useState(false);
  const [purgeImpact, setPurgeImpact] = useState<{
    submissionCount: number; unitCount: number; evidenceCount: number; subCriteriaCount: number;
  } | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(false);

  const openPurgeModal = async (id: string, name: string) => {
    setPurgeTarget({ id, name });
    setPurgeConfirmName('');
    setPurgeImpact(null);
    setLoadingImpact(true);
    try {
      const impact = await getCriteriaSetImpact(id);
      setPurgeImpact({
        submissionCount: impact.submissionCount,
        unitCount: impact.unitCount,
        evidenceCount: impact.evidenceCount,
        subCriteriaCount: impact.subCriteriaCount,
      });
    } catch {
      setPurgeImpact({ submissionCount: 0, unitCount: 0, evidenceCount: 0, subCriteriaCount: 0 });
    } finally {
      setLoadingImpact(false);
    }
  };

  const handlePurgeCriteriaSet = async () => {
    if (!purgeTarget) return;
    setPurging(true);
    try {
      const res = await purgeCriteriaSet(purgeTarget.id);
      if (res.success) {
        showToast({
          title: 'Đã xóa vĩnh viễn bộ tiêu chí',
          description: `Xóa ${res.deletedSubmissions ?? 0} bài chấm, ${res.deletedEvidences ?? 0} minh chứng, ${res.deletedFiles ?? 0} tệp. Snapshot đã lưu ở Nhật ký.`,
          type: 'success',
        });
        setPurgeTarget(null);
        setPurgeConfirmName('');
      } else {
        showToast({ title: 'Không xóa được', description: res.message, type: 'error' });
      }
    } finally {
      setPurging(false);
    }
  };
  /** Bộ đang dùng và bộ đã lưu trữ (archived_at có giá trị). */
  const activeSets = useMemo(() => criteriaSets.filter(s => !s.archived_at), [criteriaSets]);
  const archivedSets = useMemo(() => criteriaSets.filter(s => !!s.archived_at), [criteriaSets]);

  // Modal nhập bộ tiêu chí từ Excel
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Selected item in tree: could be a section, criterion, or subCriterion
  const [selectedType, setSelectedType] = useState<'section' | 'criterion' | 'subCriterion'>('subCriterion');
  const [selectedId, setSelectedId] = useState<string>(subCriteria[0]?.id || '');

  // Add Modals
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  const [isAddCriterionOpen, setIsAddCriterionOpen] = useState(false);
  const [newCriterionSectionId, setNewCriterionSectionId] = useState('');
  const [newCriterionName, setNewCriterionName] = useState('');

  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [newSubCriterionId, setNewSubCriterionId] = useState('');
  const [newSubCondition, setNewSubCondition] = useState('');
  const [newSubMaxScore, setNewSubMaxScore] = useState(5);

  // Form State for currently selected SubCriterion
  const activeSubCriterion = useMemo(
    () => activeSubCriteria.find(sc => sc.id === selectedId) || null,
    [subCriteria, selectedId]
  );

  const activeCriterion = useMemo(
    () => criteria.find(c => c.id === selectedId) || null,
    [criteria, selectedId]
  );

  const activeSection = useMemo(
    () => activeSections.find(s => s.id === selectedId) || null,
    [criteriaSections, selectedId]
  );

  // Editable subCriterion draft form
  const [subFormCondition, setSubFormCondition] = useState('');
  const [subFormMaxScore, setSubFormMaxScore] = useState<number>(5);
  const [subFormEvalMethod, setSubFormEvalMethod] = useState('');
  const [subFormEvidenceReq, setSubFormEvidenceReq] = useState('');
  const [subFormScoringRule, setSubFormScoringRule] = useState('');
  const [subFormDeadline, setSubFormDeadline] = useState('');
  const [subFormUnitTypeId, setSubFormUnitTypeId] = useState<UnitTypeId | 'all'>('all');
  const [subFormUnitId, setSubFormUnitId] = useState<string | 'all'>('all');
  const [subFormReqEvidenceType, setSubFormReqEvidenceType] = useState<'required' | 'optional'>('required');
  const [subFormReqGps, setSubFormReqGps] = useState(true);
  const [subFormReqPhoto, setSubFormReqPhoto] = useState(true);
  // Phạm vi phân công (chọn nhiều)
  const [subFormUnitTypeIds, setSubFormUnitTypeIds] = useState<UnitTypeId[]>([]);
  const [subFormUnitIds, setSubFormUnitIds] = useState<string[]>([]);
  const [subFormDept, setSubFormDept] = useState(''); // Bộ phận phụ trách (note)

  // Synchronize draft form when activeSubCriterion changes
  React.useEffect(() => {
    if (activeSubCriterion) {
      setSubFormCondition(activeSubCriterion.condition_text);
      setSubFormMaxScore(activeSubCriterion.max_score);
      setSubFormEvalMethod(activeSubCriterion.evaluation_method);
      setSubFormEvidenceReq(activeSubCriterion.evidence_requirement);
      setSubFormScoringRule(activeSubCriterion.scoring_rule);
      setSubFormDeadline(activeSubCriterion.deadline.split('T')[0]);
      const scope = normalizeScope(activeSubCriterion);
      setSubFormUnitTypeIds(scope.typeIds);
      setSubFormUnitIds(scope.unitIds);
      setSubFormDept(activeSubCriterion.note || '');
      setSubFormReqEvidenceType(activeSubCriterion.evidence_requirement.toLowerCase().includes('tùy chọn') ? 'optional' : 'required');
      setSubFormReqGps(activeSubCriterion.evidence_requirement.toLowerCase().includes('gps') || activeSubCriterion.evidence_requirement.toLowerCase().includes('vị trí'));
      setSubFormReqPhoto(activeSubCriterion.evidence_requirement.toLowerCase().includes('ảnh') || activeSubCriterion.evidence_requirement.toLowerCase().includes('hình'));
    }
  }, [activeSubCriterion]);

  // Handle Save SubCriterion form
  const handleSaveSubForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSubCriterion) return;

    const evidenceDetail = `${subFormReqEvidenceType === 'required' ? 'Bắt buộc minh chứng' : 'Tùy chọn minh chứng'}${subFormReqGps ? ' • Yêu cầu toạ độ GPS' : ''}${subFormReqPhoto ? ' • Yêu cầu ảnh chụp tại chỗ' : ''}: ${subFormEvidenceReq}`;

    updateSubCriterion(activeSubCriterion.id, {
      condition_text: subFormCondition,
      max_score: Number(subFormMaxScore),
      evaluation_method: subFormEvalMethod,
      evidence_requirement: evidenceDetail,
      scoring_rule: subFormScoringRule,
      deadline: new Date(subFormDeadline).toISOString(),
      unit_type_ids: subFormUnitTypeIds,
      unit_ids: subFormUnitIds,
      note: subFormDept.trim() || undefined,
    });
    showToast({ title: 'Đã lưu tiêu chí con', type: 'success' });
  };

  // Danh sách chi đoàn cụ thể để chọn (lọc theo loại đã tick; nếu chưa tick loại nào -> tất cả)
  const assignableUnits = useMemo(() => {
    if (subFormUnitTypeIds.length === 0) return units;
    return units.filter(u => subFormUnitTypeIds.includes(u.unit_type_id));
  }, [units, subFormUnitTypeIds]);

  // Total points validation
  const totalSubPoints = useMemo(() => {
    return activeSubCriteria.reduce((sum, sc) => sum + sc.max_score, 0);
  }, [activeSubCriteria]);

  // Orphan sub-criteria check
  const orphanSubs = useMemo(() => {
    return activeSubCriteria.filter(sc => !activeCriteria.some(c => c.id === sc.criterion_id));
  }, [activeSubCriteria, activeCriteria]);

  // Locking status
  const isLockedForYear = criteriaSet.id === yearlySettings.criteria_set_id;

  const handleToggleLock = () => {
    if (isLockedForYear) {
      updateYearlySettings({ criteria_set_id: '' });
      showToast({
        title: 'Đã mở khóa cấu trúc',
        description: 'Bộ tiêu chí đã được mở để tiếp tục chỉnh sửa cấu trúc và điều kiện.',
        type: 'info',
      });
    } else {
      if (orphanSubs.length > 0) {
        showToast({
          title: 'Phát hiện tiêu chí mồ côi',
          description: `Có ${orphanSubs.length} tiêu chí con chưa thuộc về tiêu chí lớn nào. Vui lòng kiểm tra lại.`,
          type: 'error',
        });
        return;
      }
      updateYearlySettings({ criteria_set_id: criteriaSet.id });
      showToast({
        title: 'Đã chốt Bộ tiêu chí thành công',
        description: `Bộ tiêu chí đã được khóa cố định cho niên độ ${selectedYear} (tổng ${totalSubPoints} điểm). Các chi đoàn bắt đầu tự chấm điểm.`,
        type: 'success',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Award className="w-6 h-6 text-[#1F5FBF]" />
              Bộ Tiêu chí Thi đua Cơ sở – Năm {selectedYear}
            </h1>
            {isLockedForYear && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#1F5FBF] border border-blue-200">
                Đã chốt cho năm {selectedYear}
              </span>
            )}
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {criteriaSet.name} • {activeSections.length} Phần • {activeCriteria.length} Tiêu chí • {activeSubCriteria.length} Tiêu chí con
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" /> Nhập từ Excel
          </button>
          <button
            type="button"
            onClick={cloneCriteriaSetFromPreviousYear}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Copy className="w-4 h-4 text-slate-500" /> Nhân bản từ năm trước
          </button>
        </div>
      </div>

      {/* DANH SÁCH BỘ TIÊU CHÍ THEO NĂM */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#1F5FBF]" />
            Danh sách Bộ tiêu chí theo năm ({activeSets.length} bộ)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeSets.map(cSet => {
            const isSetLocked = cSet.id === yearlySettings.criteria_set_id;
            const stats = setStats.get(cSet.id) ?? { subCount: 0, approvedCount: 0 };
            const subCount = stats.subCount;
            const approvedSubs = stats.approvedCount;

            return (
              <div
                key={cSet.id}
                onClick={() => setActiveCriteriaSet(cSet.id)}
                title="Bấm để mở bộ tiêu chí này trong cây soạn thảo"
                className={`p-3.5 rounded-lg border bg-white flex flex-col justify-between gap-2 shadow-2xs transition-all cursor-pointer hover:shadow-md ${
                  cSet.id === criteriaSet.id
                    ? 'border-[#1F5FBF] ring-2 ring-blue-200'
                    : isSetLocked
                    ? 'border-blue-400 ring-1 ring-blue-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{cSet.name}</span>
                      {cSet.id === criteriaSet.id && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1F5FBF] text-white">
                          Đang soạn
                        </span>
                      )}
                      {isSetLocked && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#1F5FBF] border border-blue-200">
                          Đã chốt cho năm
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Đơn vị giao: <span className="font-medium text-slate-700">{cSet.issuing_unit}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-bold text-slate-600 px-2 py-0.5 rounded bg-slate-100">
                      Năm {cSet.year}
                    </span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setArchiveTarget({ id: cSet.id, name: cSet.name });
                      }}
                      className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded"
                      title="Lưu trữ bộ tiêu chí (ẩn khỏi danh sách, khôi phục được)"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          openPurgeModal(cSet.id, cSet.name);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                        title="Xóa vĩnh viễn (chỉ admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <span>Số tiêu chí con: <strong className="text-slate-900">{subCount}</strong></span>
                  <span>Tiến độ chấm: <strong className="text-emerald-700">{approvedSubs} đã duyệt</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BỘ TIÊU CHÍ ĐÃ LƯU TRỮ — khôi phục được */}
      {archivedSets.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Archive className="w-4 h-4 text-amber-600" />
              Bộ đã lưu trữ ({archivedSets.length})
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-slate-500">
                Bộ đã lưu trữ bị ẩn khỏi chi đoàn và danh sách chọn. Điểm và minh chứng vẫn được giữ nguyên.
              </p>
              {archivedSets.map(cSet => (
                <div key={cSet.id} className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{cSet.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Năm {cSet.year}{cSet.archived_at ? ` • Lưu trữ ${formatDateVN(cSet.archived_at)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await restoreCriteriaSet(cSet.id);
                        if (res.success) showToast({ title: 'Đã khôi phục bộ tiêu chí', description: cSet.name, type: 'success' });
                        else showToast({ title: 'Không khôi phục được', description: res.message, type: 'error' });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openPurgeModal(cSet.id, cSet.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa vĩnh viễn
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* THANH KIỂM TRA TỰ ĐỘNG & CHỐT BỘ TIÊU CHÍ */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
        orphanSubs.length === 0
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
          : 'bg-red-50/80 border-red-200 text-red-900'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs uppercase tracking-wide">
              Kiểm tra cấu trúc bộ tiêu chí:
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-[#1F5FBF] border border-blue-300">
              Tổng điểm: {totalSubPoints}đ • {activeSubCriteria.length} tiêu chí con
            </span>

            {orphanSubs.length === 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cấu trúc hợp lệ
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5" /> Có {orphanSubs.length} tiêu chí con mồ côi
              </span>
            )}
          </div>
          <p className="text-xs opacity-90">
            {isLockedForYear
              ? `Bộ tiêu chí đã được chốt cố định cho niên độ ${selectedYear}. Cấu trúc không thể xóa hoặc thêm mới.`
              : 'Có thể chốt với bất kỳ tổng điểm nào — chỉ cần không có tiêu chí con mồ côi.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleLock}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all shadow-xs ${
              isLockedForYear
                ? 'bg-slate-700 text-white hover:bg-slate-800'
                : 'bg-[#1F5FBF] text-white hover:bg-[#154690]'
            }`}
          >
            {isLockedForYear ? (
              <>
                <Edit2 className="w-3.5 h-3.5" /> Mở khóa cấu trúc
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" /> Chốt bộ tiêu chí
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs Chuyển đổi giữa Soạn bộ tiêu chí & Ma trận tiến độ chấm */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'editor'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Soạn thảo Cây Tiêu chí</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Tiến độ chấm (Ma trận Chi đoàn × Tiêu chí con)</span>
        </button>
      </div>

      {/* TAB 1: SOẠN BỘ TIÊU CHÍ (2 CỘT) */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (5 cols): CÂY PHẦN -> TIÊU CHÍ -> TIÊU CHÍ CON */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">Cấu trúc phân cấp</span>
              <button
                type="button"
                onClick={() => setIsAddSectionOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#1F5FBF] bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Phần
              </button>
            </div>

            <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
              {activeSections.map((sec, secIdx) => {
                const secCriteria = activeCriteria.filter(c => c.section_id === sec.id);
                const isSecSelected = selectedType === 'section' && selectedId === sec.id;

                return (
                  <div key={sec.id} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40">
                    {/* Phần Header */}
                    <div
                      className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isSecSelected ? 'bg-blue-100 text-[#1F5FBF] font-bold' : 'hover:bg-slate-100/70'
                      }`}
                      onClick={() => {
                        setSelectedType('section');
                        setSelectedId(sec.id);
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded bg-blue-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                          {sec.stt}
                        </span>
                        <span className="text-xs font-bold text-slate-900 truncate" title={sec.name}>
                          {sec.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {/* Di chuyển thứ tự stt */}
                        {secIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => reorderSections(secIdx, secIdx - 1)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Lên trên"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {secIdx < activeSections.length - 1 && (
                          <button
                            type="button"
                            onClick={() => reorderSections(secIdx, secIdx + 1)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Xuống dưới"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNewCriterionSectionId(sec.id);
                            setIsAddCriterionOpen(true);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Thêm tiêu chí vào phần này"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCriteriaSection(sec.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Xóa phần"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Danh sách Tiêu chí */}
                    <div className="p-2 space-y-2 border-t border-slate-200 bg-white">
                      {secCriteria.map((crit, critIdx) => {
                        const critSubs = activeSubCriteria.filter(s => s.criterion_id === crit.id);
                        const isCritSelected = selectedType === 'criterion' && selectedId === crit.id;

                        return (
                          <div key={crit.id} className="border border-slate-100 rounded-lg p-2 bg-slate-50/50 space-y-1.5">
                            <div
                              className={`flex items-center justify-between gap-2 p-1 rounded cursor-pointer ${
                                isCritSelected ? 'bg-blue-50 text-[#1F5FBF] font-bold' : 'hover:bg-slate-100'
                              }`}
                              onClick={() => {
                                setSelectedType('criterion');
                                setSelectedId(crit.id);
                              }}
                            >
                              <span className="text-xs font-bold text-slate-800 truncate">
                                Tiêu chí {crit.stt}: {crit.name}
                              </span>

                              <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                {critIdx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => reorderCriteria(sec.id, critIdx, critIdx - 1)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                )}
                                {critIdx < secCriteria.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => reorderCriteria(sec.id, critIdx, critIdx + 1)}
                                    className="p-0.5 text-slate-400 hover:text-slate-700"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewSubCriterionId(crit.id);
                                    setIsAddSubOpen(true);
                                  }}
                                  className="p-0.5 text-blue-600 hover:bg-blue-100 rounded"
                                  title="Thêm tiêu chí con"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteCriterion(crit.id)}
                                  className="p-0.5 text-rose-500 hover:bg-rose-100 rounded"
                                  title="Xóa tiêu chí"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Danh sách Tiêu chí con */}
                            <div className="space-y-1 pl-2">
                              {critSubs.map((sub, subIdx) => {
                                const isSubSelected = selectedType === 'subCriterion' && selectedId === sub.id;
                                const subSubmissionCount = criterionSubmissions.filter(
                                  cs => cs.sub_criterion_id === sub.id
                                ).length;

                                return (
                                  <div
                                    key={sub.id}
                                    onClick={() => {
                                      setSelectedType('subCriterion');
                                      setSelectedId(sub.id);
                                    }}
                                    className={`p-2 rounded-lg text-[11px] flex items-center justify-between gap-2 border cursor-pointer transition-all ${
                                      isSubSelected
                                        ? 'bg-blue-50 border-blue-300 text-[#1F5FBF] font-bold shadow-2xs'
                                        : 'bg-white border-slate-200/80 text-slate-700 hover:border-blue-200'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate" title={sub.condition_text}>
                                        {sub.condition_text}
                                      </p>
                                      <span className="text-[10px] text-slate-400">
                                        Tối đa: {sub.max_score}đ • Hạn: {formatDateVN(sub.deadline)}
                                      </span>
                                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                        <span className="text-[9px] font-semibold text-[#1F5FBF] bg-blue-50 px-1.5 py-0.5 rounded">
                                          Giao: {describeAssignment(sub, units)}
                                        </span>
                                        {sub.note && (
                                          <span className="text-[9px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {sub.note}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                      {subIdx > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => reorderSubCriteria(crit.id, subIdx, subIdx - 1)}
                                          className="p-0.5 text-slate-400 hover:text-slate-700"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                      )}
                                      {subIdx < critSubs.length - 1 && (
                                        <button
                                          type="button"
                                          onClick={() => reorderSubCriteria(crit.id, subIdx, subIdx + 1)}
                                          className="p-0.5 text-slate-400 hover:text-slate-700"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => deleteSubCriterion(sub.id)}
                                        className="p-0.5 text-rose-500 hover:bg-rose-100 rounded"
                                        title={
                                          subSubmissionCount > 0
                                            ? `Đã có ${subSubmissionCount} chi đoàn nộp, không thể xóa`
                                            : 'Xóa tiêu chí con'
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI (7 cols): FORM CHI TIẾT CỦA MỤC ĐANG CHỌN */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
            {selectedType === 'subCriterion' && activeSubCriterion ? (
              <form onSubmit={handleSaveSubForm} className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#1F5FBF] bg-blue-50 px-2 py-0.5 rounded">
                      Chỉnh sửa Tiêu chí con
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 mt-1">
                      Mã: {activeSubCriterion.id}
                    </h3>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4" /> Lưu tiêu chí con
                  </button>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Điều kiện chấm (*):</label>
                  <textarea
                    rows={2}
                    value={subFormCondition}
                    onChange={e => setSubFormCondition(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF] focus:bg-white resize-none"
                    placeholder="Mô tả cụ thể điều kiện để đạt điểm..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Điểm tối đa:</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={subFormMaxScore}
                      onChange={e => setSubFormMaxScore(Number(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-[#1F5FBF] focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Hạn chót gửi minh chứng:</label>
                    <input
                      type="date"
                      value={subFormDeadline}
                      onChange={e => setSubFormDeadline(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Phương pháp đánh giá:</label>
                  <input
                    type="text"
                    value={subFormEvalMethod}
                    onChange={e => setSubFormEvalMethod(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra thực tế và đối soát hồ sơ..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>

                {/* Yêu cầu minh chứng chi tiết */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <label className="font-bold text-slate-800 block">Yêu cầu minh chứng (*):</label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Tính bắt buộc:</label>
                      <select
                        value={subFormReqEvidenceType}
                        onChange={e => setSubFormReqEvidenceType(e.target.value as any)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                      >
                        <option value="required">Bắt buộc minh chứng</option>
                        <option value="optional">Tùy chọn minh chứng</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="checkGps"
                        checked={subFormReqGps}
                        onChange={e => setSubFormReqGps(e.target.checked)}
                        className="w-4 h-4 text-[#1F5FBF] rounded"
                      />
                      <label htmlFor="checkGps" className="text-xs text-slate-700 font-medium cursor-pointer">
                        Yêu cầu toạ độ GPS
                      </label>
                    </div>

                    <div className="flex items-center gap-2 pt-5">
                      <input
                        type="checkbox"
                        id="checkPhoto"
                        checked={subFormReqPhoto}
                        onChange={e => setSubFormReqPhoto(e.target.checked)}
                        className="w-4 h-4 text-[#1F5FBF] rounded"
                      />
                      <label htmlFor="checkPhoto" className="text-xs text-slate-700 font-medium cursor-pointer">
                        Yêu cầu ảnh tại chỗ
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Mô tả tài liệu / ảnh cần nộp:</label>
                    <input
                      type="text"
                      value={subFormEvidenceReq}
                      onChange={e => setSubFormEvidenceReq(e.target.value)}
                      placeholder="Ví dụ: Biên bản cuộc họp, ảnh chụp gắn toạ độ, danh sách ký nhận..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Nguyên tắc chấm / Biểu điểm chi tiết:</label>
                  <textarea
                    rows={2}
                    value={subFormScoringRule}
                    onChange={e => setSubFormScoringRule(e.target.value)}
                    placeholder="Ví dụ: Đạt 100%: 5đ; Đạt 80%: 3đ..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF] resize-none"
                  />
                </div>

                {/* Bộ phận phụ trách (cột H) */}
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Bộ phận phụ trách:</label>
                  <input
                    type="text"
                    value={subFormDept}
                    onChange={e => setSubFormDept(e.target.value)}
                    placeholder="Ví dụ: Bộ phận Tuyên giáo, Bộ phận Phong trào..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>

                {/* Phân công chi đoàn (chọn nhiều) */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 block">Phân công chi đoàn thực hiện:</span>
                    <span className="text-[11px] font-semibold text-[#1F5FBF] bg-blue-50 px-2 py-0.5 rounded">
                      {describeAssignment({ unit_type_ids: subFormUnitTypeIds, unit_ids: subFormUnitIds }, units)}
                    </span>
                  </div>

                  {/* Chọn loại chi đoàn */}
                  <div>
                    <label className="text-slate-600 block mb-1.5">Theo loại Chi đoàn:</label>
                    <div className="flex flex-wrap gap-2">
                      {(['residential', 'school', 'health', 'police'] as const).map(t => {
                        const checked = subFormUnitTypeIds.includes(t);
                        return (
                          <label
                            key={t}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer text-[11px] font-semibold transition-colors ${
                              checked ? 'bg-[#1F5FBF] text-white border-[#1F5FBF]' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={checked}
                              onChange={e => {
                                setSubFormUnitTypeIds(prev =>
                                  e.target.checked ? [...prev, t] : prev.filter(x => x !== t)
                                );
                                // Bỏ chọn các chi đoàn không còn thuộc loại đã chọn
                                setSubFormUnitIds(prev =>
                                  prev.filter(id => {
                                    const u = units.find(x => x.id === id);
                                    return u && (e.target.checked ? true : u.unit_type_id !== t);
                                  })
                                );
                              }}
                            />
                            {unitTypeLabel(t)}
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => { setSubFormUnitTypeIds([]); setSubFormUnitIds([]); }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 text-[11px] font-semibold cursor-pointer"
                      >
                        Bỏ chọn (áp dụng tất cả)
                      </button>
                    </div>
                  </div>

                  {/* Chọn chi đoàn cụ thể */}
                  <div>
                    <label className="text-slate-600 block mb-1.5">
                      Hoặc giao cho chi đoàn cụ thể ({subFormUnitIds.length} đã chọn):
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                      {assignableUnits.map(u => {
                        const checked = subFormUnitIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e =>
                                setSubFormUnitIds(prev =>
                                  e.target.checked ? [...prev, u.id] : prev.filter(x => x !== u.id)
                                )
                              }
                              className="w-3.5 h-3.5 text-[#1F5FBF] rounded"
                            />
                            <span className="text-[11px] text-slate-700">{u.name}</span>
                            <span className="text-[10px] text-slate-400 ml-auto">{unitTypeLabel(u.unit_type_id)}</span>
                          </label>
                        );
                      })}
                      {assignableUnits.length === 0 && (
                        <p className="p-3 text-center text-slate-400 text-[11px]">Không có chi đoàn nào thuộc loại đã chọn</p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    Không tick gì = áp dụng cho <b>tất cả chi đoàn</b>. Tick loại để giới hạn theo loại;
                    tick chi đoàn cụ thể để chỉ giao cho các chi đoàn đó.
                  </p>
                </div>
              </form>
            ) : selectedType === 'criterion' && activeCriterion ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-[#1F5FBF] bg-blue-50 px-2 py-0.5 rounded">
                    Tiêu chí lớn
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateCriterion(activeCriterion.id, activeCriterion.name);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] rounded-lg"
                  >
                    Lưu
                  </button>
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Tên tiêu chí lớn:</label>
                  <input
                    type="text"
                    value={activeCriterion.name}
                    onChange={e => updateCriterion(activeCriterion.id, e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>
            ) : selectedType === 'section' && activeSection ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-[#1F5FBF] bg-blue-50 px-2 py-0.5 rounded">
                    Phần tiêu chí
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      updateCriteriaSection(activeSection.id, activeSection.name);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] rounded-lg"
                  >
                    Lưu
                  </button>
                </div>
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Tên phần tiêu chí:</label>
                  <input
                    type="text"
                    value={activeSection.name}
                    onChange={e => updateCriteriaSection(activeSection.id, e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                Hãy chọn một mục ở cây bên trái để xem và chỉnh sửa thông số.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TIẾN ĐỘ CHẤM (MA TRẬN CHI ĐOÀN × TIÊU CHÍ CON) */}
      {activeTab === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm md:text-base font-bold text-slate-900">
                Ma trận Tiến độ chấm điểm thi đua ({units.length} Chi đoàn × {activeSubCriteria.length} Tiêu chí con)
              </h3>
              <p className="text-xs text-slate-500">
                Nhấp trực tiếp vào ô để mở nhanh màn duyệt hoặc xem chi tiết điểm nộp
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                Đã duyệt
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                Chờ duyệt
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-400 font-bold">
                Chưa nộp
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-20 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3 sticky left-0 bg-slate-50 z-30 min-w-44 border-r border-slate-200 shadow-xs">
                    Chi đoàn cơ sở
                  </th>
                  {activeSubCriteria.map((sub, idx) => (
                    <th key={sub.id} className="p-3 min-w-36 text-center border-r border-slate-200">
                      <div className="line-clamp-1 font-bold text-slate-900" title={sub.condition_text}>
                        TC con {idx + 1}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">Tối đa {sub.max_score}đ</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {units.map(unit => (
                  <tr key={unit.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-2.5 font-bold text-slate-900 sticky left-0 bg-white border-r border-slate-200 z-10 shadow-xs">
                      {unit.name}
                    </td>

                    {activeSubCriteria.map(sub => {
                      const applicable = isSubCriterionApplicableToUnit(sub, unit);
                      const submission = criterionSubmissions.find(
                        cs => cs.sub_criterion_id === sub.id && cs.unit_id === unit.id
                      );

                      // Chi đoàn không được giao tiêu chí này
                      if (!applicable) {
                        return (
                          <td
                            key={sub.id}
                            className="p-2 text-center border-r border-slate-200 bg-slate-50/60"
                            title="Tiêu chí không giao cho chi đoàn này"
                          >
                            <span className="text-[10px] text-slate-300">Không áp dụng</span>
                          </td>
                        );
                      }

                      if (!submission) {
                        return (
                          <td key={sub.id} className="p-2 text-center border-r border-slate-200">
                            <span className="text-slate-300 font-medium">—</span>
                          </td>
                        );
                      }

                      if (submission.status === 'approved') {
                        return (
                          <td
                            key={sub.id}
                            onClick={() => navigate('/duyet')}
                            className="p-2 text-center border-r border-slate-200 cursor-pointer hover:bg-emerald-50"
                            title="Bấm để xem chi tiết duyệt"
                          >
                            <span className="inline-block px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 text-[11px]">
                              {submission.approved_score}đ
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={sub.id}
                          onClick={() => navigate('/duyet')}
                          className="p-2 text-center border-r border-slate-200 cursor-pointer hover:bg-amber-50"
                          title="Bấm để duyệt ngay"
                        >
                          <span className="inline-block px-2 py-0.5 rounded font-bold bg-amber-100 text-amber-800 text-[11px]">
                            Chờ: {submission.self_score}đ
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL THÊM PHẦN TIÊU CHÍ */}
      {isAddSectionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Thêm Phần Tiêu chí mới</h3>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tên Phần:</label>
              <input
                type="text"
                value={newSectionName}
                onChange={e => setNewSectionName(e.target.value)}
                placeholder="Ví dụ: Phần IV: Công tác Kiểm tra Giám sát..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddSectionOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSectionName.trim()) {
                    createCriteriaSection(newSectionName.trim());
                    setIsAddSectionOpen(false);
                    setNewSectionName('');
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
              >
                Thêm phần
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM TIÊU CHÍ */}
      {isAddCriterionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Thêm Tiêu chí lớn</h3>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tên Tiêu chí:</label>
              <input
                type="text"
                value={newCriterionName}
                onChange={e => setNewCriterionName(e.target.value)}
                placeholder="Ví dụ: Công tác cán bộ Đoàn và quản lý đoàn viên..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCriterionOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newCriterionName.trim() && newCriterionSectionId) {
                    createCriterion(newCriterionSectionId, newCriterionName.trim());
                    setIsAddCriterionOpen(false);
                    setNewCriterionName('');
                  }
                }}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
              >
                Thêm tiêu chí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÊM TIÊU CHÍ CON */}
      {isAddSubOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-slate-900">Thêm Tiêu chí con</h3>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Điều kiện chấm (*):</label>
              <textarea
                rows={2}
                value={newSubCondition}
                onChange={e => setNewSubCondition(e.target.value)}
                placeholder="Ví dụ: 100% đoàn viên tham gia sinh hoạt..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF] resize-none"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Điểm tối đa:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={newSubMaxScore}
                onChange={e => setNewSubMaxScore(Number(e.target.value))}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-[#1F5FBF]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddSubOpen(false)}
                className="px-3 py-1.5 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSubCondition.trim() && newSubCriterionId) {
                    createSubCriterion({
                      criterion_id: newSubCriterionId,
                      condition_text: newSubCondition.trim(),
                      max_score: Number(newSubMaxScore),
                      evaluation_method: 'Kiểm tra thực tế',
                      evidence_requirement: 'Biên bản và hình ảnh xác thực',
                      scoring_rule: 'Đạt yêu cầu được tối đa điểm',
                      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                      unit_type_id: null,
                      unit_id: null,
                      unit_type_ids: [],
                      unit_ids: [],
                    });
                    setIsAddSubOpen(false);
                    setNewSubCondition('');
                  }
                }}
                className="px-4 py-1.5 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
              >
                Thêm tiêu chí con
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LƯU TRỮ BỘ TIÊU CHÍ */}
      {archiveTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Archive className="w-4 h-4 text-amber-600" /> Lưu trữ bộ tiêu chí
              </h3>
              <button type="button" onClick={() => setArchiveTarget(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700">
              Bộ <b className="break-words">{archiveTarget.name}</b> sẽ bị ẩn khỏi danh sách chọn và khỏi chi đoàn.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
              <p className="font-bold">Điều gì vẫn được giữ:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Toàn bộ Phần, Tiêu chí, tiêu chí con.</li>
                <li>Điểm đã duyệt và minh chứng của chi đoàn.</li>
                <li>Khôi phục lại được bất cứ lúc nào.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setArchiveTarget(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Huỷ</button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleArchiveCriteriaSet}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-60"
              >
                {archiving ? 'Đang lưu trữ…' : 'Lưu trữ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XÓA VĨNH VIỄN (chỉ admin) */}
      {purgeTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4 text-rose-600" /> Xóa vĩnh viễn bộ tiêu chí
              </h3>
              <button type="button" onClick={() => { setPurgeTarget(null); setPurgeConfirmName(''); }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 break-words">
              Bộ: <b>{purgeTarget.name}</b>
            </p>

            {loadingImpact ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              </div>
            ) : purgeImpact && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                <p className="font-bold">Sẽ xóa vĩnh viễn:</p>
                <p>
                  <b>{purgeImpact.submissionCount}</b> bài chấm • <b>{purgeImpact.evidenceCount}</b> minh chứng
                  • của <b>{purgeImpact.unitCount}</b> chi đoàn • <b>{purgeImpact.subCriteriaCount}</b> tiêu chí con.
                </p>
                <p className="text-rose-700">Không hoàn tác được. Ảnh minh chứng trong Storage cũng bị xóa.</p>
                <p className="text-emerald-700 font-semibold">
                  Trước khi xóa, hệ thống lưu một snapshot JSON vào Nhật ký để có thể dựng lại dữ liệu.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Gõ chính xác tên bộ để xác nhận:
              </label>
              <p className="text-[11px] text-slate-500 break-words">{purgeTarget.name}</p>
              <input
                type="text"
                value={purgeConfirmName}
                onChange={e => setPurgeConfirmName(e.target.value)}
                placeholder="Nhập tên bộ tiêu chí"
                className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setPurgeTarget(null); setPurgeConfirmName(''); }}
                className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Huỷ</button>
              <button
                type="button"
                disabled={purgeConfirmName.trim() !== purgeTarget.name.trim() || purging || loadingImpact}
                onClick={handlePurgeCriteriaSet}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg ${
                  purgeConfirmName.trim() !== purgeTarget.name.trim() || purging || loadingImpact
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {purging ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NHẬP BỘ TIÊU CHÍ TỪ EXCEL */}
      <ImportCriteriaModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={id => setActiveCriteriaSet(id)}
      />
    </div>
  );
};
