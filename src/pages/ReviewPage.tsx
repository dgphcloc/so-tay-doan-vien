import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { canReview, isAdminLevel } from '../utils/permissions';
import {
  FileCheck2,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  Camera,
  Upload,
  FileText,
  AlertCircle,
  Hash,
  X,
  RotateCcw,
  Sparkles,
  Loader2,
  ArrowUpDown,
  Maximize2,
  Copy,
  Info,
} from 'lucide-react';
import { ReviewStatus, TaskResult, CriterionSubmission, Evidence, UnitTypeId } from '../types';
import { ReviewStatusBadge, DeadlineWarningBadge } from '../components/common/StatusBadge';
import { formatDateVN, formatDateTimeVN } from '../mock/data';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { MemberSubmissionsPanel } from '../components/review/MemberSubmissionsPanel';
import { TaskResultsPanel } from '../components/review/TaskResultsPanel';

export const ReviewPage: React.FC = () => {
  const {
    taskResults,
    criterionSubmissions,
    tasks,
    subCriteria,
    units,
    members,
    evidences,
    taskSubCriteria,
    taskPendingCount,
    criteriaPendingCount,
    memberSubmissions,
    currentRole,
    currentMember,
    approveTaskResult,
    rejectTaskResult,
    approveCriterionSubmission,
    rejectCriterionSubmission,
    getUnitById,
    getMemberById,
    getTaskById,
    getSubCriterionById,
    showToast,
  } = useApp();

  // Số bài đoàn viên chờ duyệt (bí thư chi đoàn chỉ đếm chi đoàn mình)
  const memberPendingCount = useMemo(
    () => memberSubmissions.filter(s =>
      s.status === 'pending' &&
      (isAdminLevel(currentRole) || s.unit_id === currentMember?.unit_id)
    ).length,
    [memberSubmissions, currentRole, currentMember?.unit_id]
  );

  // Active Tab
  const [activeTab, setActiveTab] = useState<'tasks' | 'criteria' | 'members'>('tasks');

  // Loading simulation state
  const [loading, setLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);

  // Simulated initial fetch delay
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('pending');
  const [taskOrCritFilter, setTaskOrCritFilter] = useState<string>('all');

  // Sorting & Pagination
  const [sortField, setSortField] = useState<'date' | 'unit'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 20;

  // Selected item for review detail drawer
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedCriterionId, setSelectedCriterionId] = useState<string | null>(null);

  // Đang gửi duyệt/từ chối — khoá nút để tránh bấm hai lần
  const [busyReview, setBusyReview] = useState(false);

  // Reject modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Editable approved score for criterion submission
  const [approvedScoreInput, setApprovedScoreInput] = useState<number>(0);
  const [scoreError, setScoreError] = useState<string | null>(null);

  // Lightbox modal for evidence
  const [activeLightboxEvidence, setActiveLightboxEvidence] = useState<Evidence | null>(null);

  // Synchronize score input when selectedCriterionId changes
  useEffect(() => {
    if (selectedCriterionId) {
      const subm = criterionSubmissions.find(s => s.id === selectedCriterionId);
      if (subm) {
        setApprovedScoreInput(subm.approved_score ?? subm.self_score);
        setScoreError(null);
      }
    }
  }, [selectedCriterionId, criterionSubmissions]);

  // Filtered Task Results
  const filteredTaskResults = useMemo(() => {
    return taskResults.filter(item => {
      const unit = getUnitById(item.unit_id);
      const task = getTaskById(item.task_id);
      const submitter = getMemberById(item.submitted_by);

      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (selectedUnitFilter !== 'all' && item.unit_id !== selectedUnitFilter) return false;
      if (selectedTypeFilter !== 'all' && unit?.unit_type_id !== selectedTypeFilter) return false;
      if (taskOrCritFilter !== 'all' && item.task_id !== taskOrCritFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUnit = unit?.name.toLowerCase().includes(q);
        const matchesTask = task?.title.toLowerCase().includes(q);
        const matchesSubmitter = submitter?.full_name.toLowerCase().includes(q);
        const matchesNote = item.note?.toLowerCase().includes(q);
        if (!matchesUnit && !matchesTask && !matchesSubmitter && !matchesNote) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const diff = new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
        return sortOrder === 'desc' ? diff : -diff;
      } else {
        const unitA = getUnitById(a.unit_id)?.name || '';
        const unitB = getUnitById(b.unit_id)?.name || '';
        return sortOrder === 'desc' ? unitB.localeCompare(unitA) : unitA.localeCompare(unitB);
      }
    });
  }, [taskResults, statusFilter, selectedUnitFilter, selectedTypeFilter, taskOrCritFilter, searchQuery, sortField, sortOrder, getUnitById, getTaskById, getMemberById]);

  // Filtered Criterion Submissions
  const filteredCriterionSubmissions = useMemo(() => {
    return criterionSubmissions.filter(item => {
      const unit = getUnitById(item.unit_id);
      const sub = getSubCriterionById(item.sub_criterion_id);
      const submitter = getMemberById(item.submitted_by);

      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (selectedUnitFilter !== 'all' && item.unit_id !== selectedUnitFilter) return false;
      if (selectedTypeFilter !== 'all' && unit?.unit_type_id !== selectedTypeFilter) return false;
      if (taskOrCritFilter !== 'all' && item.sub_criterion_id !== taskOrCritFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesUnit = unit?.name.toLowerCase().includes(q);
        const matchesSub = sub?.condition_text.toLowerCase().includes(q);
        const matchesSubmitter = submitter?.full_name.toLowerCase().includes(q);
        const matchesNote = item.note?.toLowerCase().includes(q);
        if (!matchesUnit && !matchesSub && !matchesSubmitter && !matchesNote) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'date') {
        const diff = new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
        return sortOrder === 'desc' ? diff : -diff;
      } else {
        const unitA = getUnitById(a.unit_id)?.name || '';
        const unitB = getUnitById(b.unit_id)?.name || '';
        return sortOrder === 'desc' ? unitB.localeCompare(unitA) : unitA.localeCompare(unitB);
      }
    });
  }, [criterionSubmissions, statusFilter, selectedUnitFilter, selectedTypeFilter, taskOrCritFilter, searchQuery, sortField, sortOrder, getUnitById, getSubCriterionById, getMemberById]);

  // Active current detail item
  const currentTaskResult = useMemo(
    () => (selectedTaskId ? taskResults.find(r => r.id === selectedTaskId) || null : null),
    [selectedTaskId, taskResults]
  );

  const currentCriterionSubmission = useMemo(
    () => (selectedCriterionId ? criterionSubmissions.find(s => s.id === selectedCriterionId) || null : null),
    [selectedCriterionId, criterionSubmissions]
  );

  // Quyền duyệt: admin/super_admin mọi bài; bí thư chi đoàn chỉ bài do chi đoàn mình
  // nộp VÀ nhiệm vụ do chính mình giao.
  const canReviewCurrent = useMemo(() => {
    if (activeTab === 'tasks' && currentTaskResult) {
      const task = getTaskById(currentTaskResult.task_id);
      const myUnitId = currentMember?.unit_id ?? null;
      const itemUnitId = currentTaskResult.unit_id;
      const assignedByMe = !!currentMember && task?.assigned_by === currentMember.id;
      return canReview(currentRole, { itemUnitId, myUnitId, assignedByMe });
    }
    if (activeTab === 'criteria' && currentCriterionSubmission) {
      // Bài tiêu chí: chỉ admin/super_admin duyệt (không gắn nhiệm vụ)
      return canReview(currentRole, {});
    }
    return isAdminLevel(currentRole);
  }, [activeTab, currentTaskResult, currentCriterionSubmission, currentRole, currentMember, getTaskById]);

  // Evidence list for selected item
  const activeEvidences = useMemo(() => {
    if (activeTab === 'tasks' && currentTaskResult) {
      return evidences.filter(e => e.task_id === currentTaskResult.task_id && e.unit_id === currentTaskResult.unit_id);
    }
    if (activeTab === 'criteria' && currentCriterionSubmission) {
      return evidences.filter(e => e.submission_id === currentCriterionSubmission.id);
    }
    return [];
  }, [activeTab, currentTaskResult, currentCriterionSubmission, evidences]);

  // Navigation handlers (Next / Previous items)
  const handlePrevItem = useCallback(() => {
    if (activeTab === 'tasks') {
      const currentIndex = filteredTaskResults.findIndex(r => r.id === selectedTaskId);
      if (currentIndex > 0) {
        setSelectedTaskId(filteredTaskResults[currentIndex - 1].id);
      }
    } else {
      const currentIndex = filteredCriterionSubmissions.findIndex(s => s.id === selectedCriterionId);
      if (currentIndex > 0) {
        setSelectedCriterionId(filteredCriterionSubmissions[currentIndex - 1].id);
      }
    }
  }, [activeTab, filteredTaskResults, filteredCriterionSubmissions, selectedTaskId, selectedCriterionId]);

  const handleNextItem = useCallback(() => {
    if (activeTab === 'tasks') {
      const currentIndex = filteredTaskResults.findIndex(r => r.id === selectedTaskId);
      if (currentIndex >= 0 && currentIndex < filteredTaskResults.length - 1) {
        setSelectedTaskId(filteredTaskResults[currentIndex + 1].id);
      }
    } else {
      const currentIndex = filteredCriterionSubmissions.findIndex(s => s.id === selectedCriterionId);
      if (currentIndex >= 0 && currentIndex < filteredCriterionSubmissions.length - 1) {
        setSelectedCriterionId(filteredCriterionSubmissions[currentIndex + 1].id);
      }
    }
  }, [activeTab, filteredTaskResults, filteredCriterionSubmissions, selectedTaskId, selectedCriterionId]);

  // Keyboard navigation: ArrowLeft, ArrowRight, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeLightboxEvidence) {
        if (e.key === 'Escape') setActiveLightboxEvidence(null);
        return;
      }
      if (isRejectModalOpen) {
        if (e.key === 'Escape') setIsRejectModalOpen(false);
        return;
      }
      if (selectedTaskId || selectedCriterionId) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevItem();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextItem();
        } else if (e.key === 'Escape') {
          setSelectedTaskId(null);
          setSelectedCriterionId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, selectedCriterionId, activeLightboxEvidence, isRejectModalOpen, handlePrevItem, handleNextItem]);

  // Check evidence warnings
  const getEvidenceWarnings = (ev: Evidence, deadlineStr: string) => {
    const warnList: string[] = [];

    // 1. Thiếu GPS
    if (ev.lat === null || ev.lng === null) {
      warnList.push('Thiếu toạ độ GPS');
    }

    // 2. Chụp sau hạn
    if (ev.captured_at && deadlineStr) {
      const capTime = new Date(ev.captured_at).getTime();
      const deadTime = new Date(deadlineStr).getTime();
      if (capTime > deadTime) {
        warnList.push('Chụp sau hạn chót');
      }
    }

    // 3. Trùng ảnh với minh chứng khác (so file_hash)
    const duplicate = evidences.some(other => other.id !== ev.id && other.file_hash === ev.file_hash);
    if (duplicate) {
      warnList.push('Trùng ảnh với minh chứng khác');
    }

    return warnList;
  };

  // Approve action for current item
  const handleApproveCurrent = async () => {
    if (busyReview) return;
    if (activeTab === 'tasks' && currentTaskResult) {
      setBusyReview(true);
      try {
        const res = await approveTaskResult(currentTaskResult.id);
        if (res.success) {
          showToast({ title: 'Đã duyệt hồ sơ', description: 'Hồ sơ chuyển sang trạng thái Đã duyệt.', type: 'success' });
        } else {
          showToast({ title: 'Không duyệt được', description: res.message, type: 'error' });
        }
      } catch (e) {
        showToast({ title: 'Không duyệt được', description: e instanceof Error ? e.message : 'Lỗi không xác định', type: 'error' });
      } finally {
        setBusyReview(false);
      }
    } else if (activeTab === 'criteria' && currentCriterionSubmission) {
      const sub = getSubCriterionById(currentCriterionSubmission.sub_criterion_id);
      const maxScore = sub?.max_score ?? 10;
      if (approvedScoreInput > maxScore) {
        setScoreError(`Điểm duyệt không được vượt quá điểm tối đa (${maxScore} điểm)`);
        return;
      }
      if (approvedScoreInput < 0) {
        setScoreError('Điểm duyệt không được âm');
        return;
      }
      setBusyReview(true);
      try {
        const res = await approveCriterionSubmission(currentCriterionSubmission.id, approvedScoreInput);
        if (res.success) {
          showToast({ title: 'Đã duyệt bài tiêu chí', description: `Cộng ${approvedScoreInput} điểm cho chi đoàn.`, type: 'success' });
        } else {
          showToast({ title: 'Không duyệt được', description: res.message, type: 'error' });
        }
      } catch (e) {
        showToast({ title: 'Không duyệt được', description: e instanceof Error ? e.message : 'Lỗi không xác định', type: 'error' });
      } finally {
        setBusyReview(false);
      }
    }
  };

  // Reject confirm
  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      showToast({ title: 'Vui lòng nhập lý do từ chối', type: 'error' });
      return;
    }
    if (busyReview) return;
    if (activeTab === 'tasks' && currentTaskResult) {
      setBusyReview(true);
      try {
        const res = await rejectTaskResult(currentTaskResult.id, rejectReason.trim());
        if (!res.success) {
          showToast({ title: 'Không từ chối được', description: res.message, type: 'error' });
          return;
        }
        showToast({ title: 'Đã từ chối hồ sơ', description: 'Chi đoàn sẽ thấy lý do và nộp lại được.', type: 'success' });
        setIsRejectModalOpen(false);
        setRejectReason('');
        handleNextItem();
      } finally {
        setBusyReview(false);
      }
    } else if (activeTab === 'criteria' && currentCriterionSubmission) {
      rejectCriterionSubmission(currentCriterionSubmission.id, rejectReason.trim());
      setIsRejectModalOpen(false);
      setRejectReason('');
      handleNextItem();
    }
  };

  // Current sub-criteria score contributions for task results
  const contributionsForCurrentTask = useMemo(() => {
    if (!currentTaskResult) return [];
    return taskSubCriteria
      .filter(tsc => tsc.task_id === currentTaskResult.task_id)
      .map(tsc => {
        const sub = getSubCriterionById(tsc.sub_criterion_id);
        return {
          sub,
          score: tsc.contribution_score,
        };
      });
  }, [currentTaskResult, taskSubCriteria, getSubCriterionById]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileCheck2 className="w-6 h-6 text-[#1F5FBF]" />
            Chờ duyệt Minh chứng & Điểm tự chấm
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Xem xét báo cáo, kiểm tra tính xác thực toạ độ GPS, mã ảnh và phê duyệt điểm thi đua
          </p>
        </div>
      </div>

      {/* Tabs Chuyển đổi: Kết quả nhiệm vụ vs Điểm tự chấm */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => {
            setActiveTab('tasks');
            setSelectedTaskId(null);
            setSelectedCriterionId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'tasks'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Kết quả nhiệm vụ</span>
          {taskPendingCount > 0 && (
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                activeTab === 'tasks' ? 'bg-[#1F5FBF] text-white' : 'bg-red-500 text-white'
              }`}
            >
              {taskPendingCount}
            </span>
          )}
        </button>


        <button
          type="button"
          onClick={() => {
            setActiveTab('members');
            setSelectedTaskId(null);
            setSelectedCriterionId(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'members'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Bài đoàn viên</span>
          {memberPendingCount > 0 && (
            <span
              className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                activeTab === 'members' ? 'bg-[#1F5FBF] text-white' : 'bg-emerald-500 text-white'
              }`}
            >
              {memberPendingCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'members' && <MemberSubmissionsPanel />}

      {/* Thanh Tìm kiếm & Bộ lọc */}
      {activeTab === 'members' && (
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo chi đoàn, nhiệm vụ, người nộp, ghi chú..."
              className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1F5FBF] focus:bg-white"
            />
          </div>

          {/* Chip Lọc Trạng thái */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
            <span className="text-xs text-slate-500 font-semibold mr-1">Trạng thái:</span>
            {(['pending', 'approved', 'rejected', 'all'] as const).map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 ${
                  statusFilter === st
                    ? 'bg-[#1F5FBF] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'pending'
                  ? 'Chờ duyệt'
                  : st === 'approved'
                  ? 'Đã duyệt'
                  : st === 'rejected'
                  ? 'Từ chối'
                  : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Lọc Chi đoàn */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Chi đoàn:</span>
            <select
              value={selectedUnitFilter}
              onChange={e => setSelectedUnitFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả chi đoàn</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Loại chi đoàn */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Loại:</span>
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả loại</option>
              <option value="residential">Dân cư</option>
              <option value="school">Trường học</option>
              <option value="health">Y tế</option>
              <option value="police">Công an</option>
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-slate-500">Sắp xếp:</span>
            <button
              type="button"
              onClick={() => {
                setSortField(sortField === 'date' ? 'unit' : 'date');
              }}
              className="inline-flex items-center gap-1 text-slate-700 font-semibold hover:text-[#1F5FBF] cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortField === 'date' ? 'Theo ngày gửi' : 'Theo tên chi đoàn'}
            </button>
          </div>
        </div>
      </div>

      )}

      {/* Bảng dữ liệu / Danh sách Card (Mobile) */}
      {activeTab === 'tasks' ? (
        <TaskResultsPanel />
      ) : activeTab === 'members' ? null : loading ? (
        <TableSkeleton rows={6} />
      ) : hasError ? (
        <ErrorState onRetry={() => setLoading(false)} />
      ) : (
        /* Tab: Điểm tự chấm */
        filteredCriterionSubmissions.length === 0 ? (
          <EmptyState
            title="Không tìm thấy hồ sơ tự chấm"
            description="Hiện không có hồ sơ tự chấm điểm nào phù hợp với điều kiện lọc."
            actionText="Xem tất cả trạng thái"
            onAction={() => setStatusFilter('all')}
          />
        ) : (
          <div className="space-y-4">
            {/* Desktop Table (≥768px) */}
            <div className="hidden md:block bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Chi đoàn</th>
                    <th className="p-3.5">Tiêu chí con</th>
                    <th className="p-3.5 text-center">Tự chấm</th>
                    <th className="p-3.5 text-center">Điểm duyệt</th>
                    <th className="p-3.5">Ngày nộp</th>
                    <th className="p-3.5">Người nộp</th>
                    <th className="p-3.5 text-center">Minh chứng</th>
                    <th className="p-3.5 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCriterionSubmissions.map(item => {
                    const unit = getUnitById(item.unit_id);
                    const sub = getSubCriterionById(item.sub_criterion_id);
                    const submitter = getMemberById(item.submitted_by);
                    const evCount = evidences.filter(e => e.submission_id === item.id).length;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedCriterionId(item.id)}
                        className={`hover:bg-blue-50/40 cursor-pointer transition-colors ${
                          selectedCriterionId === item.id ? 'bg-blue-50/60 font-semibold' : ''
                        }`}
                      >
                        <td className="p-3.5 font-bold text-slate-900">{unit?.name}</td>
                        <td className="p-3.5 font-medium text-slate-800 max-w-sm truncate" title={sub?.condition_text}>
                          {sub?.condition_text}
                        </td>
                        <td className="p-3.5 text-center font-bold text-blue-600">
                          {item.self_score}/{sub?.max_score}
                        </td>
                        <td className="p-3.5 text-center font-bold text-emerald-600">
                          {item.approved_score !== null ? `${item.approved_score}đ` : '—'}
                        </td>
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">{formatDateVN(item.submitted_at)}</td>
                        <td className="p-3.5 text-slate-600">{submitter?.full_name}</td>
                        <td className="p-3.5 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">
                            {evCount} tệp
                          </span>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <ReviewStatusBadge status={item.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List (<768px) */}
            <div className="md:hidden space-y-3">
              {filteredCriterionSubmissions.map(item => {
                const unit = getUnitById(item.unit_id);
                const sub = getSubCriterionById(item.sub_criterion_id);
                const submitter = getMemberById(item.submitted_by);
                const evCount = evidences.filter(e => e.submission_id === item.id).length;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedCriterionId(item.id)}
                    className="p-4 bg-white rounded-xl border border-slate-200/90 shadow-xs space-y-2.5 active:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-bold text-[#1F5FBF] block">{unit?.name}</span>
                        <h3 className="text-xs font-bold text-slate-900 line-clamp-1">{sub?.condition_text}</h3>
                      </div>
                      <ReviewStatusBadge status={item.status} />
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold pt-1 border-t border-slate-100">
                      <span>Tự chấm: {item.self_score}đ</span>
                      <span className="text-emerald-600">
                        Duyệt: {item.approved_score !== null ? `${item.approved_score}đ` : 'Chưa duyệt'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Người nộp: {submitter?.full_name}</span>
                      <span>{evCount} minh chứng</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* MÀN CHI TIẾT DUYỆT (Ngăn rộng trượt từ phải / Modal chia 2 cột) */}
      {(selectedTaskId || selectedCriterionId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Top Navigation Bar of Detail Modal */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F5FBF] bg-blue-100 px-2 py-0.5 rounded">
                  {activeTab === 'tasks' ? 'Duyệt Kết quả nhiệm vụ' : 'Duyệt Điểm tự chấm'}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">• Nhấn phím mũi tên ← → để chuyển</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevItem}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  title="Mục trước (Phím mũi tên trái)"
                >
                  <ChevronLeft className="w-4 h-4" /> ‹ Trước
                </button>
                <button
                  type="button"
                  onClick={handleNextItem}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  title="Mục sau (Phím mũi tên phải)"
                >
                  Tiếp › <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                    setSelectedCriterionId(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 ml-2 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Body: Split 2 Columns */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cột Trái: Thông tin nhiệm vụ / chi đoàn */}
              <div className="space-y-4">
                {activeTab === 'tasks' && currentTaskResult ? (
                  <>
                    <div>
                      <span className="text-[11px] font-semibold text-[#1F5FBF]">
                        {getUnitById(currentTaskResult.unit_id)?.name}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-0.5">
                        {getTaskById(currentTaskResult.task_id)?.title}
                      </h2>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Người gửi:</span>
                        <span className="font-semibold text-slate-800">
                          {getMemberById(currentTaskResult.submitted_by)?.full_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Hạn chót:</span>
                        <span className="font-semibold text-slate-800">
                          {formatDateVN(getTaskById(currentTaskResult.task_id)?.due_date || '')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ngày nộp báo cáo:</span>
                        <span className="font-semibold text-slate-800">
                          {formatDateVN(currentTaskResult.completed_at)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Số lượng đoàn viên tham gia:</span>
                        <span className="font-bold text-[#1F5FBF]">
                          {currentTaskResult.participant_count} người
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Trạng thái:</span>
                        <ReviewStatusBadge status={currentTaskResult.status} />
                      </div>
                    </div>

                    {/* Ghi chú của chi đoàn */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-1">Ghi chú từ Chi đoàn:</h4>
                      <p className="text-xs text-slate-600 bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 leading-relaxed">
                        {currentTaskResult.note || 'Không có ghi chú thêm.'}
                      </p>
                    </div>

                    {/* Danh sách điểm sẽ cộng vào các tiêu chí (lấy từ task_sub_criteria) */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Điểm sẽ cộng vào các tiêu chí con khi duyệt:
                      </h4>
                      {contributionsForCurrentTask.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-2.5 bg-slate-50 rounded-lg">
                          Nhiệm vụ này không gắn tiêu chí con nào (theo kế hoạch chuyên đề riêng).
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {contributionsForCurrentTask.map((c, i) => (
                            <div
                              key={i}
                              className="p-2.5 bg-blue-50/60 border border-blue-100 rounded-lg text-xs flex items-center justify-between gap-2"
                            >
                              <span className="text-slate-700 line-clamp-2">{c.sub?.condition_text}</span>
                              <span className="font-bold text-[#1F5FBF] shrink-0">+{c.score} điểm</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Lý do từ chối nếu có */}
                    {currentTaskResult.review_note && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs">
                        <span className="font-bold text-rose-800 block">Ý kiến nhận xét / Lý do:</span>
                        <p className="text-rose-700 mt-1">{currentTaskResult.review_note}</p>
                      </div>
                    )}
                  </>
                ) : activeTab === 'criteria' && currentCriterionSubmission ? (
                  <>
                    <div>
                      <span className="text-[11px] font-semibold text-[#1F5FBF]">
                        {getUnitById(currentCriterionSubmission.unit_id)?.name}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-0.5">
                        Hồ sơ tự chấm điểm tiêu chí thi đua
                      </h2>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Điều kiện tiêu chí:</span>
                        <p className="font-semibold text-slate-800 mt-0.5 leading-snug">
                          {getSubCriterionById(currentCriterionSubmission.sub_criterion_id)?.condition_text}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between">
                        <span className="text-slate-500">Điểm tối đa:</span>
                        <span className="font-bold text-slate-800">
                          {getSubCriterionById(currentCriterionSubmission.sub_criterion_id)?.max_score} điểm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Chi đoàn tự chấm:</span>
                        <span className="font-bold text-blue-600">
                          {currentCriterionSubmission.self_score} điểm
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Người nộp:</span>
                        <span className="font-semibold text-slate-800">
                          {getMemberById(currentCriterionSubmission.submitted_by)?.full_name}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Ngày gửi:</span>
                        <span className="font-semibold text-slate-800">
                          {formatDateVN(currentCriterionSubmission.submitted_at)}
                        </span>
                      </div>
                    </div>

                    {/* Ô nhập điểm duyệt */}
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2">
                      <label className="text-xs font-bold text-slate-800 block">
                        Điểm duyệt chính thức (tối đa {getSubCriterionById(currentCriterionSubmission.sub_criterion_id)?.max_score} điểm):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={approvedScoreInput}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setApprovedScoreInput(val);
                            const max = getSubCriterionById(currentCriterionSubmission.sub_criterion_id)?.max_score ?? 10;
                            if (val > max) {
                              setScoreError(`Không được vượt quá ${max} điểm`);
                            } else if (val < 0) {
                              setScoreError('Không được nhập điểm âm');
                            } else {
                              setScoreError(null);
                            }
                          }}
                          className={`w-32 px-3 py-2 text-base font-bold text-slate-900 bg-white border rounded-lg focus:outline-none ${
                            scoreError ? 'border-rose-500 focus:ring-2 focus:ring-rose-200' : 'border-slate-300 focus:border-[#1F5FBF]'
                          }`}
                        />
                        <span className="text-xs text-slate-500 font-medium">điểm</span>
                      </div>
                      {scoreError && <p className="text-xs text-rose-600 font-semibold">{scoreError}</p>}
                    </div>

                    {/* Ghi chú */}
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 mb-1">Ghi chú từ chi đoàn:</h4>
                      <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
                        {currentCriterionSubmission.note || 'Không có ghi chú.'}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Cột Phải: Lưới minh chứng & Cảnh báo tự động */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs md:text-sm font-bold text-slate-800">
                    Minh chứng đính kèm ({activeEvidences.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">Bấm ảnh để phóng to & xem toạ độ</span>
                </div>

                {activeEvidences.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Chưa có tệp minh chứng nào được tải lên.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {activeEvidences.map(ev => {
                      const deadlineStr =
                        activeTab === 'tasks'
                          ? getTaskById(currentTaskResult?.task_id)?.due_date || ''
                          : getSubCriterionById(currentCriterionSubmission?.sub_criterion_id)?.deadline || '';
                      const warningsFound = getEvidenceWarnings(ev, deadlineStr);

                      return (
                        <div
                          key={ev.id}
                          className="group relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-2xs hover:border-blue-400 transition-all flex flex-col"
                        >
                          {/* Ảnh hoặc Icon tệp */}
                          {ev.evidence_type === 'photo' ? (
                            <div
                              onClick={() => setActiveLightboxEvidence(ev)}
                              className="relative h-28 bg-slate-200 overflow-hidden cursor-pointer"
                            >
                              <img
                                src={ev.url}
                                alt={ev.file_name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Maximize2 className="w-5 h-5 drop-shadow" />
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setActiveLightboxEvidence(ev)}
                              className="h-28 bg-blue-50/60 flex flex-col items-center justify-center p-3 text-center cursor-pointer group-hover:bg-blue-100/60 transition-colors"
                            >
                              <FileText className="w-8 h-8 text-[#1F5FBF] mb-1" />
                              <span className="text-[11px] font-semibold text-slate-800 line-clamp-1">
                                {ev.file_name}
                              </span>
                              <span className="text-[10px] text-slate-400 mt-0.5">Bấm xem báo cáo</span>
                            </div>
                          )}

                          {/* Info chi tiết rút gọn */}
                          <div className="p-2.5 text-[11px] space-y-1.5 flex-1">
                            <p className="font-semibold text-slate-800 truncate" title={ev.file_name}>
                              {ev.file_name}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                {ev.source === 'camera' ? (
                                  <Camera className="w-3 h-3 text-slate-400" />
                                ) : (
                                  <Upload className="w-3 h-3 text-slate-400" />
                                )}
                                {ev.source === 'camera' ? 'Máy ảnh' : 'Tải lên'}
                              </span>
                              <span className="font-mono text-slate-400">#{ev.file_hash.substring(0, 8)}</span>
                            </div>

                            {/* Cảnh báo tự động trên từng minh chứng */}
                            {warningsFound.length > 0 && (
                              <div className="space-y-1 pt-1 border-t border-slate-200/60">
                                {warningsFound.map((w, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 w-full"
                                  >
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{w}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              {!canReviewCurrent ? (
                <div className="flex-1 text-center text-xs text-slate-500 font-medium">
                  Bạn không có quyền duyệt hồ sơ này.
                </div>
              ) : (
              <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  Từ chối
                </button>
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const alreadyHandled =
                    (activeTab === 'tasks' && currentTaskResult && currentTaskResult.status !== 'pending') ||
                    (activeTab === 'criteria' && currentCriterionSubmission && currentCriterionSubmission.status !== 'pending');
                  if (alreadyHandled) {
                    return (
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        Hồ sơ đã được xử lý
                      </span>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={handleApproveCurrent}
                      disabled={!!scoreError || busyReview}
                      className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-lg transition-all shadow-xs cursor-pointer ${
                        scoreError || busyReview
                          ? 'bg-slate-400 cursor-not-allowed opacity-60'
                          : 'bg-[#1F5FBF] hover:bg-[#154690] active:scale-95'
                      }`}
                    >
                      {busyReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {busyReview ? 'Đang duyệt…' : 'Duyệt hồ sơ'}
                    </button>
                  );
                })()}
              </div>
              </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL: Minh chứng chi tiết (Ảnh + Mini bản đồ GPS + Hash) */}
      {activeLightboxEvidence && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs md:text-sm font-bold text-slate-900 truncate">
                  {activeLightboxEvidence.file_name}
                </h4>
                <p className="text-[11px] text-slate-500">Mã minh chứng: {activeLightboxEvidence.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveLightboxEvidence(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Media Preview */}
              {activeLightboxEvidence.evidence_type === 'photo' ? (
                <div className="rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center max-h-80">
                  <img
                    src={activeLightboxEvidence.url}
                    alt={activeLightboxEvidence.file_name}
                    className="max-h-80 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 bg-blue-50 rounded-xl text-center space-y-2 border border-blue-100">
                  <FileText className="w-12 h-12 text-[#1F5FBF] mx-auto" />
                  <p className="text-sm font-bold text-slate-800">{activeLightboxEvidence.file_name}</p>
                  <p className="text-xs text-slate-500">Tệp tài liệu báo cáo nghiệm thu</p>
                  <a
                    href={activeLightboxEvidence.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] rounded-lg mt-2 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Mở toàn văn bản
                  </a>
                </div>
              )}

              {/* Thông tin thời gian & Nguồn */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block font-medium">Thời gian chụp:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateTimeVN(activeLightboxEvidence.captured_at)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Thời gian tải lên:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDateTimeVN(activeLightboxEvidence.uploaded_at)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Nguồn dữ liệu:</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {activeLightboxEvidence.source === 'camera' ? 'Chụp trực tiếp từ Camera' : 'Tải lên từ thư viện'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Mã Hash (SHA-256):</span>
                  <span className="font-mono text-slate-700 truncate block">
                    {activeLightboxEvidence.file_hash}
                  </span>
                </div>
              </div>

              {/* Khung Giả lập Mini Bản đồ từ lat/lng */}
              <div>
                <h5 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  Toạ độ GPS ghi nhận trên thiết bị
                </h5>

                {activeLightboxEvidence.lat !== null && activeLightboxEvidence.lng !== null ? (
                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 fill-rose-600/20" />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">
                          {activeLightboxEvidence.lat.toFixed(6)}, {activeLightboxEvidence.lng.toFixed(6)}
                        </p>
                        <p className="text-[11px] text-slate-500">Khu vực xã Hòa Bình, tỉnh Cà Mau</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          `${activeLightboxEvidence.lat}, ${activeLightboxEvidence.lng}`
                        );
                        showToast({ title: 'Đã sao chép toạ độ GPS', type: 'info' });
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" /> Sao chép toạ độ
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="font-semibold">
                      Cảnh báo: Tệp minh chứng này không có siêu dữ liệu vị trí GPS.
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setActiveLightboxEvidence(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TỪ CHỐI (Bắt buộc nhập review_note) */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Từ chối duyệt kết quả</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Lý do từ chối & Yêu cầu bổ sung (bắt buộc):
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Ví dụ: Ảnh chụp không rõ nét, thiếu toạ độ GPS tại hiện trường hoặc chưa có biên bản nghiệm thu..."
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-rose-500 focus:bg-white resize-none"
              />
              <p className="text-[11px] text-slate-400">
                Lý do này sẽ được gửi thông báo ngay tới Bí thư chi đoàn để kịp thời nộp lại.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Huỷ bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim()}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs cursor-pointer ${
                  !rejectReason.trim()
                    ? 'bg-rose-300 cursor-not-allowed'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
