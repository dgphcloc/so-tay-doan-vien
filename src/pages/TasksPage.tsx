import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { TaskQrModal } from '../components/tasks/TaskQrModal';
import { TaskParticipantsPanel } from '../components/tasks/TaskParticipantsPanel';
import { TaskCriteriaModal } from '../components/tasks/TaskCriteriaModal';
import {
  CheckSquare,
  QrCode,
  Search,
  Plus,
  Copy,
  Archive,
  Trash2,
  Calendar,
  Award,
  Users,
  MapPin,
  ChevronRight,
  ChevronLeft,
  X,
  FileCheck2,
  Clock,
  AlertTriangle,
  Bell,
  CheckCircle2,
  XCircle,
  Eye,
  Sliders,
  Filter,
  Check,
  Send,
  Building2,
  Info,
  ExternalLink,
} from 'lucide-react';
import { Task, TaskStatus, Unit, SubCriterion } from '../types';
import { formatDateVN, formatDateTimeVN, getRelativeDate } from '../mock/data';
import { DeadlineWarningBadge, ReviewStatusBadge } from '../components/common/StatusBadge';
import { canCreateTask, canManageTasks } from '../utils/permissions';

export const TasksPage: React.FC = () => {
  const {
    tasks,
    taskUnits,
    taskResults,
    taskSubCriteria,
    taskRegistrations,
    units,
    members,
    criteriaSections,
    criteria,
    subCriteria,
    createTask,
    closeTask,
    countUnitsWithoutResult,
    deleteTask,
    cloneTask,
    remindAllUnsubmitted,
    remindUnit,
    getUnitById,
    getMemberById,
    getSubCriterionById,
    currentRole,
    currentMember,
    showToast,
  } = useApp();

  const navigate = useNavigate();

  // Phân quyền nhiệm vụ
  const canCreate = canCreateTask(currentRole);
  const canManage = canManageTasks(currentRole);
  const isUnitSecretary = currentRole === 'unit_secretary';
  const myUnitId = currentMember?.unit_id ?? null;

  // Active status tab: 'published' | 'draft' | 'closed'
  const [activeTab, setActiveTab] = useState<TaskStatus>('published');
  const [search, setSearch] = useState('');

  // Selected task for detail view
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'units' | 'registrations' | 'results'>('overview');

  // Confirmation modals
  const [closeConfirmTaskId, setCloseConfirmTaskId] = useState<string | null>(null);

  // Stepper Modal for "Tạo nhiệm vụ"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTarget, setFormTarget] = useState('');
  const [formEvaluationCriteria, setFormEvaluationCriteria] = useState('');
  const [formMaxScore, setFormMaxScore] = useState<number>(10);
  const [qrTask, setQrTask] = useState<{ id: string; title: string } | null>(null);
  const [criteriaTaskId, setCriteriaTaskId] = useState<string | null>(null);
  const [formSubmitScope, setFormSubmitScope] = useState<'assigned' | 'open'>('assigned');
  const [savingTask, setSavingTask] = useState(false);
  const [closeConfirmText, setCloseConfirmText] = useState('');
  const [closingTask, setClosingTask] = useState(false);
  const [closeWarning, setCloseWarning] = useState<{ assigned: number; submitted: number; missing: string[] } | null>(null);
  const [loadingCloseInfo, setLoadingCloseInfo] = useState(false);
  const [formReminderDays, setFormReminderDays] = useState<number[]>([7, 3, 1]);
  const [formLat, setFormLat] = useState<number | null>(9.1824);
  const [formLng, setFormLng] = useState<number | null>(105.1528);

  // Step 2 State: Selected units
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitSearch, setUnitSearch] = useState('');

  // Step 3 State: SubCriteria contributions
  const [subCriteriaContributions, setSubCriteriaContributions] = useState<
    Array<{ sub_criterion_id: string; contribution_score: number }>
  >([]);

  // Bộ lọc nhiệm vụ theo vai trò: all | mine (do tôi tạo) | myunit (chi đoàn tôi) | joined (tôi tham gia)
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine' | 'myunit' | 'joined'>('all');

  // Tập nhiệm vụ mà chi đoàn của tôi được giao
  const myUnitTaskIds = useMemo(
    () => new Set(taskUnits.filter(tu => tu.unit_id === myUnitId).map(tu => tu.task_id)),
    [taskUnits, myUnitId]
  );
  // Tập nhiệm vụ tôi (đoàn viên) đã đăng ký tham gia
  const myJoinedTaskIds = useMemo(
    () => new Set(taskRegistrations.filter(tr => tr.member_id === currentMember?.id).map(tr => tr.task_id)),
    [taskRegistrations, currentMember]
  );

  // Filter tasks by active tab & search & scope
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (t.status !== activeTab) return false;

      // Giới hạn theo vai trò trước
      if (isUnitSecretary) {
        // Bí thư CĐ: chỉ nhiệm vụ do mình tạo HOẶC giao cho chi đoàn mình
        const mine = t.assigned_by === currentMember?.id;
        const forMyUnit = myUnitTaskIds.has(t.id);
        if (!mine && !forMyUnit) return false;
        if (scopeFilter === 'mine' && !mine) return false;
        if (scopeFilter === 'myunit' && !forMyUnit) return false;
      } else if (currentRole === 'member') {
        // Đoàn viên: chỉ nhiệm vụ mình tham gia
        if (!myJoinedTaskIds.has(t.id)) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        return t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q);
      }
      return true;
    });
  }, [tasks, activeTab, search, scopeFilter, isUnitSecretary, currentRole, currentMember, myUnitTaskIds, myJoinedTaskIds]);

  // Tab counts
  const publishedCount = tasks.filter(t => t.status === 'published').length;
  const draftCount = tasks.filter(t => t.status === 'draft').length;
  const closedCount = tasks.filter(t => t.status === 'closed').length;

  // Active units for step 2 (exclude inactive)
  const activeUnits = useMemo(() => units.filter(u => u.is_active), [units]);

  const filteredStepUnits = useMemo(() => {
    if (!unitSearch.trim()) return activeUnits;
    return activeUnits.filter(u => u.name.toLowerCase().includes(unitSearch.toLowerCase()));
  }, [activeUnits, unitSearch]);

  // Reset creation form
  const handleOpenCreateModal = () => {
    setFormTitle('');
    setFormContent('');
    // Default to +7 days
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setFormDueDate(nextWeek.toISOString().split('T')[0]);
    setFormTarget('100% đoàn viên tham gia đóng góp tích cực và hoàn thành chỉ tiêu.');
    setFormEvaluationCriteria('Hình ảnh nghiệm thu rõ mặt, có định vị GPS tại hiện trường.');
    setFormMaxScore(10);
    setFormSubmitScope('assigned');    setFormReminderDays([7, 3, 1]);
    setFormLat(9.1824);
    setFormLng(105.1528);
    if (isUnitSecretary) {
      // Bí thư chi đoàn: chỉ giao cho chi đoàn mình
      setSelectedUnitIds(myUnitId ? [myUnitId] : []);
    } else {
      // Mặc định chọn các chi đoàn dân cư
      setSelectedUnitIds(activeUnits.filter(u => u.unit_type_id === 'residential').map(u => u.id));
    }
    setSubCriteriaContributions([]);
    setStep(1);
    setIsCreateModalOpen(true);
  };

  // Step 2 unit helpers
  const handleSelectAllUnits = () => {
    if (selectedUnitIds.length === activeUnits.length) {
      setSelectedUnitIds([]);
    } else {
      setSelectedUnitIds(activeUnits.map(u => u.id));
    }
  };

  const handleSelectByType = (typeId: string) => {
    const matchingIds = activeUnits.filter(u => u.unit_type_id === typeId).map(u => u.id);
    const allSelected = matchingIds.every(id => selectedUnitIds.includes(id));
    if (allSelected) {
      setSelectedUnitIds(prev => prev.filter(id => !matchingIds.includes(id)));
    } else {
      setSelectedUnitIds(prev => Array.from(new Set([...prev, ...matchingIds])));
    }
  };

  // Step 3 Criteria toggle
  const handleToggleSubCriterion = (subId: string) => {
    const existing = subCriteriaContributions.find(sc => sc.sub_criterion_id === subId);
    if (existing) {
      setSubCriteriaContributions(prev => prev.filter(sc => sc.sub_criterion_id !== subId));
    } else {
      const sub = subCriteria.find(s => s.id === subId);
      setSubCriteriaContributions(prev => [
        ...prev,
        { sub_criterion_id: subId, contribution_score: Math.min(3, sub?.max_score || 3) },
      ]);
    }
  };

  const handleUpdateContributionScore = (subId: string, score: number) => {
    setSubCriteriaContributions(prev =>
      prev.map(sc => (sc.sub_criterion_id === subId ? { ...sc, contribution_score: score } : sc))
    );
  };

  // Step 4: Submit as Draft or Published
  const handleSaveTask = async (statusToSet: 'draft' | 'published') => {
    if (!formTitle.trim()) {
      showToast({ title: 'Vui lòng nhập tên nhiệm vụ', type: 'error' });
      setStep(1);
      return;
    }
    if (!formDueDate) {
      showToast({ title: 'Vui lòng chọn hạn chót', type: 'error' });
      setStep(1);
      return;
    }
    if (selectedUnitIds.length === 0) {
      showToast({ title: 'Chặn thao tác', description: 'Vui lòng chọn ít nhất một chi đoàn được giao!', type: 'error' });
      setStep(2);
      return;
    }

    setSavingTask(true);
    try {
      await createTask(
        {
          title: formTitle.trim(),
          content: formContent.trim() || 'Thực hiện theo kế hoạch Ban Chấp hành Đoàn xã ban hành.',
          due_date: new Date(formDueDate).toISOString(),
          status: statusToSet,
          reminder_days: formReminderDays,
          target: formTarget.trim() || 'Hoàn thành chỉ tiêu được giao',
          evaluation_criteria: formEvaluationCriteria.trim() || 'Có biên bản và hình ảnh nghiệm thu',
          max_score: Number(formMaxScore),
          submit_scope: formSubmitScope,
          lat: formLat,
          lng: formLng,
        },
        selectedUnitIds,
        subCriteriaContributions
      );
      showToast({
        title: statusToSet === 'published' ? 'Đã phát động nhiệm vụ' : 'Đã lưu nhiệm vụ nháp',
        type: 'success',
      });
      setIsCreateModalOpen(false);
      setActiveTab(statusToSet);
    } catch (e) {
      // Không đóng modal: giữ nguyên dữ liệu để người dùng sửa và thử lại
      showToast({
        title: 'Không tạo được nhiệm vụ',
        description: e instanceof Error ? e.message : 'Lỗi không xác định',
        type: 'error',
      });
    } finally {
      setSavingTask(false);
    }
  };

  /** Khi mở modal đóng: kiểm tra còn chi đoàn nào chưa nộp bài tổng hợp. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!closeConfirmTaskId) { setCloseWarning(null); return; }
      setLoadingCloseInfo(true);
      try {
        const info = await countUnitsWithoutResult(closeConfirmTaskId);
        if (!cancelled) setCloseWarning(info);
      } catch {
        if (!cancelled) setCloseWarning(null);
      } finally {
        if (!cancelled) setLoadingCloseInfo(false);
      }
    })();
    return () => { cancelled = true; };
  }, [closeConfirmTaskId, countUnitsWithoutResult]);

  /** Đóng nhiệm vụ: bắt buộc gõ "dong" để xác nhận, báo lỗi rõ nếu DB từ chối. */
  const handleConfirmClose = async () => {
    const id = closeConfirmTaskId;
    if (!id) return;
    setClosingTask(true);
    try {
      const res = await closeTask(id);
      if (res?.success === false) {
        showToast({ title: 'Không đóng được nhiệm vụ', description: res.message, type: 'error' });
        return;
      }
      showToast({ title: 'Đã đóng nhiệm vụ', type: 'success' });
      // Cập nhật đủ 3 trường, nếu không khối "Người đóng" sẽ trống cho tới khi F5
      setSelectedTask(prev => (prev && prev.id === id
        ? { ...prev, status: 'closed', closed_by: currentMember?.id ?? null, closed_at: new Date().toISOString() }
        : prev));
      setCloseConfirmTaskId(null);
      setCloseConfirmText('');
    } catch (e) {
      showToast({
        title: 'Không đóng được nhiệm vụ',
        description: e instanceof Error ? e.message : 'Lỗi không xác định',
        type: 'error',
      });
    } finally {
      setClosingTask(false);
    }
  };

  // Assigned units details for selected task in detail view
  const assignedUnitsForSelected = useMemo(() => {
    if (!selectedTask) return [];
    return taskUnits.filter(tu => tu.task_id === selectedTask.id).map(tu => getUnitById(tu.unit_id));
  }, [selectedTask, taskUnits, getUnitById]);

  // Unit rows for detail view
  const unitDetailRows = useMemo(() => {
    if (!selectedTask) return [];
    return assignedUnitsForSelected.map(unit => {
      if (!unit) return null;
      const result = taskResults.find(r => r.task_id === selectedTask.id && r.unit_id === unit.id);
      const isOverdue = new Date(selectedTask.due_date) < new Date();

      let statusLabel = 'Chưa nộp';
      let statusColor = isOverdue ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600';

      if (result) {
        if (result.status === 'approved') {
          statusLabel = 'Đã duyệt';
          statusColor = 'bg-emerald-100 text-emerald-800';
        } else if (result.status === 'pending') {
          statusLabel = 'Chờ duyệt';
          statusColor = 'bg-amber-100 text-amber-800';
        } else if (result.status === 'rejected') {
          statusLabel = 'Từ chối';
          statusColor = 'bg-rose-100 text-rose-800';
        }
      } else if (isOverdue) {
        statusLabel = 'Trễ hạn';
      }

      return {
        unit,
        result,
        statusLabel,
        statusColor,
        isOverdue,
      };
    }).filter(Boolean);
  }, [selectedTask, assignedUnitsForSelected, taskResults]);

  // Số đoàn viên đã bấm tham gia nhiệm vụ đang chọn (chỉ để hiện số trên tab)
  const joinedCountForSelected = useMemo(
    () => (selectedTask ? taskRegistrations.filter(tr => tr.task_id === selectedTask.id && tr.is_joining).length : 0),
    [selectedTask, taskRegistrations]
  );

  // Danh sách đoàn viên tham gia: người giao việc và bí thư xã xem được.
  // Bí thư chi đoàn chỉ thấy với nhiệm vụ do chính mình tạo.
  const canSeeParticipants = useMemo(() => {
    if (!selectedTask) return false;
    if (canManage) return true;                       // admin / super_admin
    return selectedTask.assigned_by === currentMember?.id; // người tạo nhiệm vụ
  }, [selectedTask, canManage, currentMember?.id]);

  // Results for detail view
  const resultsForSelected = useMemo(() => {
    if (!selectedTask) return [];
    return taskResults.filter(tr => tr.task_id === selectedTask.id);
  }, [selectedTask, taskResults]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-[#1F5FBF]" />
            Quản lý Nhiệm vụ & Chiến dịch Thanh niên
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Phát động, theo dõi tiến độ chi đoàn nộp báo cáo và quản lý chu trình duyệt
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs md:text-sm font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Tạo nhiệm vụ mới
          </button>
        )}
      </div>

      {/* Tabs Nháp | Đã đăng | Đã đóng */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('published')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'published'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Đã đăng</span>
          <span
            className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === 'published' ? 'bg-[#1F5FBF] text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {publishedCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('draft')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'draft'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Bản nháp</span>
          <span
            className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === 'draft' ? 'bg-[#1F5FBF] text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {draftCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('closed')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'closed'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Đã đóng</span>
          <span
            className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === 'closed' ? 'bg-[#1F5FBF] text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {closedCount}
          </span>
        </button>
      </div>

      {/* Tìm kiếm + bộ lọc theo vai trò */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Tìm kiếm nhiệm vụ ${activeTab === 'published' ? 'đang triển khai' : activeTab === 'draft' ? 'bản nháp' : 'đã đóng'}...`}
            className="w-full pl-9 pr-4 py-1.5 text-xs md:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
          />
        </div>

        {isUnitSecretary && (
          <div className="flex items-center gap-1.5 shrink-0">
            {([
              { id: 'all', label: 'Tất cả' },
              { id: 'mine', label: 'Do tôi tạo' },
              { id: 'myunit', label: 'Chi đoàn tôi' },
            ] as const).map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setScopeFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  scopeFilter === f.id ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Danh sách nhiệm vụ dạng Bảng đầy đủ các cột */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5">Tên nhiệm vụ</th>
                <th className="p-3.5 whitespace-nowrap">Hạn chót</th>
                <th className="p-3.5 min-w-44">Tiến độ (Đã nộp/Giao)</th>
                <th className="p-3.5 text-center">Chờ duyệt</th>
                <th className="p-3.5 text-center whitespace-nowrap">Điểm tối đa</th>
                <th className="p-3.5 whitespace-nowrap">Người giao</th>
                <th className="p-3.5 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Không có nhiệm vụ nào trong danh mục này.
                  </td>
                </tr>
              ) : (
                filteredTasks.map(task => {
                  const assignedCount = taskUnits.filter(tu => tu.task_id === task.id).length;
                  const submittedCount = taskResults.filter(
                    tr => tr.task_id === task.id && (tr.status === 'approved' || tr.status === 'pending')
                  ).length;
                  const pendingCount = taskResults.filter(tr => tr.task_id === task.id && tr.status === 'pending').length;
                  const percent = assignedCount > 0 ? Math.round((submittedCount / assignedCount) * 100) : 0;
                  const assigner = getMemberById(task.assigned_by);

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3.5 font-bold text-slate-900 max-w-sm">
                        <span className="line-clamp-2 hover:text-[#1F5FBF] transition-colors">{task.title}</span>
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <DeadlineWarningBadge dueDate={task.due_date} />
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-700">
                              {submittedCount}/{assignedCount} chi đoàn
                            </span>
                            <span className="font-bold text-slate-500">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-[#1F5FBF] h-1.5 rounded-full"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        {pendingCount > 0 ? (
                          <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 text-[11px]">
                            {pendingCount} mục
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center font-bold text-[#1F5FBF] whitespace-nowrap">
                        {task.max_score} điểm
                      </td>

                      <td className="p-3.5 text-slate-600 whitespace-nowrap">{assigner?.full_name || 'Bí thư Đoàn'}</td>

                      <td className="p-3.5 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Nhân bản */}
                          <button
                            type="button"
                            onClick={() => cloneTask(task.id)}
                            className="p-1.5 text-slate-500 hover:text-[#1F5FBF] hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Nhân bản nhiệm vụ"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {/* Nút Đóng nhiệm vụ: CHỈ bí thư xã/admin, nhiệm vụ do mình phát động */}
                          {task.status === 'published' && canManage && (
                            <button
                              type="button"
                              onClick={() => setCloseConfirmTaskId(task.id)}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"
                              title="Đóng nhiệm vụ"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}

                          {/* Nút Xóa (CHỈ CHO NHIỆM VỤ NHÁP) */}
                          {task.status === 'draft' ? (
                            <button
                              type="button"
                              onClick={() => deleteTask(task.id)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Xóa nhiệm vụ nháp"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              className="p-1.5 text-slate-300 cursor-not-allowed"
                              title="Chỉ cho phép xóa nhiệm vụ nháp"
                            >
                              <Trash2 className="w-4 h-4 opacity-30" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CHI TIẾT NHIỆM VỤ MODAL / FULL VIEW */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header chi tiết */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      selectedTask.status === 'published'
                        ? 'bg-blue-100 text-[#1F5FBF]'
                        : selectedTask.status === 'draft'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedTask.status === 'published'
                      ? 'Đang triển khai'
                      : selectedTask.status === 'draft'
                      ? 'Dự thảo'
                      : 'Đã hoàn thành/Đóng'}
                  </span>
                  <DeadlineWarningBadge dueDate={selectedTask.due_date} />
                  <span className="text-xs text-slate-400">Hạn: {formatDateVN(selectedTask.due_date)}</span>
                </div>
                <h2 className="text-base md:text-lg font-bold text-slate-900 leading-snug">{selectedTask.title}</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    Người phát động: <b className="text-slate-700">{getMemberById(selectedTask.assigned_by)?.full_name ?? '—'}</b>
                    {selectedTask.assigned_at && ` • ${formatDateTimeVN(selectedTask.assigned_at)}`}
                  </span>
                  <span>
                    {selectedTask.closed_by
                      ? <>Người đóng: <b className="text-slate-700">{getMemberById(selectedTask.closed_by)?.full_name ?? '—'}</b>{selectedTask.closed_at && ` • ${formatDateTimeVN(selectedTask.closed_at)}`}</>
                      : selectedTask.status !== 'closed'
                      ? (new Date(selectedTask.due_date) < new Date()
                          ? <span className="text-rose-600 font-semibold">Quá hạn — chưa đóng</span>
                          : <span className="text-slate-400">Chưa đóng</span>)
                      : <span className="text-slate-400">Không rõ người đóng</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedTask.status === 'published' && (
                  <button
                    type="button"
                    onClick={() => setQrTask({ id: selectedTask.id, title: selectedTask.title })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg shadow-xs cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Tạo QR
                  </button>
                )}
                {selectedTask.status === 'published' && canManage && (
                  <button
                    type="button"
                    onClick={() => {
                      remindAllUnsubmitted(selectedTask.id);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" /> Nhắc tất cả chưa nộp
                  </button>
                )}
                {selectedTask.status === 'published' && canManage && (
                  <button
                    type="button"
                    onClick={() => setCloseConfirmTaskId(selectedTask.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" /> Đóng nhiệm vụ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 4 Tabs Chi tiết */}
            <div className="flex items-center gap-4 px-5 border-b border-slate-200 bg-white text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setDetailTab('overview')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  detailTab === 'overview'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Tổng quan
              </button>

              <button
                type="button"
                onClick={() => setDetailTab('units')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  detailTab === 'units'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Chi đoàn được giao ({assignedUnitsForSelected.length})
              </button>

              {canSeeParticipants && (
              <button
                type="button"
                onClick={() => setDetailTab('registrations')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  detailTab === 'registrations'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Đoàn viên tham gia ({joinedCountForSelected} đăng ký)
              </button>
              )}

              <button
                type="button"
                onClick={() => setDetailTab('results')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  detailTab === 'results'
                    ? 'border-[#1F5FBF] text-[#1F5FBF]'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Kết quả & Minh chứng ({resultsForSelected.length})
              </button>
            </div>

            {/* Nội dung Tab */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {detailTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                    <h4 className="font-bold text-slate-900">Nội dung chi tiết phát động:</h4>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">{selectedTask.content}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1">
                      <span className="font-bold text-[#1F5FBF]">Chỉ tiêu đề ra:</span>
                      <p className="text-slate-700">{selectedTask.target}</p>
                    </div>

                    <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-1">
                      <span className="font-bold text-emerald-800">Tiêu chí đánh giá / Nghiệm thu:</span>
                      <p className="text-slate-700">{selectedTask.evaluation_criteria || 'Theo biên bản và hình ảnh xác thực'}</p>
                    </div>

                    {(selectedTask.lat !== null && selectedTask.lng !== null) && (
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 md:col-span-2">
                        <span className="font-bold text-slate-800">Toạ độ hiện trường:</span>
                        <p className="text-slate-700">
                          {selectedTask.lat.toFixed(5)}, {selectedTask.lng.toFixed(5)}
                          {' • '}
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${selectedTask.lat},${selectedTask.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#1F5FBF] font-semibold hover:underline"
                          >
                            Mở Google Maps
                          </a>
                        </p>
                      </div>
                    )}

                    <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100 space-y-1 md:col-span-2">
                      <span className="font-bold text-amber-800">Phạm vi nộp minh chứng cá nhân:</span>
                      <p className="text-slate-700">
                        {selectedTask.submit_scope === 'open'
                          ? 'Ai cũng tham gia được'
                          : 'Chỉ đoàn viên thuộc chi đoàn được giao'}
                      </p>
                    </div>
                  </div>

                  {/* Tiêu chí con đã gắn */}
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      Tiêu chí con gắn với nhiệm vụ:
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setCriteriaTaskId(selectedTask.id)}
                          className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-[#1F5FBF] bg-blue-50 hover:bg-blue-100 rounded-lg"
                        >
                          <Award className="w-3 h-3" /> {taskSubCriteria.some(t => t.task_id === selectedTask.id) ? 'Sửa tiêu chí' : 'Gắn tiêu chí'}
                        </button>
                      )}
                    </h4>
                    {taskSubCriteria.filter(tsc => tsc.task_id === selectedTask.id).length === 0 ? (
                      <p className="text-slate-500 italic">
                        Nhiệm vụ này chưa gắn tiêu chí con nào — sẽ không được tính vào cột "Số nhiệm vụ" trong bảng xếp loại.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {taskSubCriteria
                          .filter(tsc => tsc.task_id === selectedTask.id)
                          .map(tsc => {
                            const sub = getSubCriterionById(tsc.sub_criterion_id);
                            return (
                              <div
                                key={tsc.sub_criterion_id}
                                className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center"
                              >
                                <span className="font-medium text-slate-800">{sub?.condition_text}</span>
                                <span className="font-bold text-[#1F5FBF]">+{tsc.contribution_score} điểm</span>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'units' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-slate-500 pb-2 border-b border-slate-200">
                    <span>Trạng thái nộp của từng Chi đoàn:</span>
                    <span>{unitDetailRows.length} chi đoàn được giao</span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                    {unitDetailRows.map(row => {
                      if (!row) return null;
                      return (
                        <div key={row.unit.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                          <div>
                            <span className="font-bold text-slate-900">{row.unit.name}</span>
                            <span className="text-[11px] text-slate-400 ml-2 capitalize">({row.unit.unit_type_id})</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${row.statusColor}`}>
                              {row.statusLabel}
                            </span>

                            {row.statusLabel === 'Chưa nộp' && (
                              <button
                                type="button"
                                onClick={() => remindUnit(selectedTask.id, row.unit.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-[#1F5FBF] bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer transition-colors"
                              >
                                Nhắc nhở
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {detailTab === 'registrations' && (
                <TaskParticipantsPanel taskId={selectedTask.id} />
              )}

              {detailTab === 'results' && (
                <div className="space-y-3 text-xs">
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
                    {resultsForSelected.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">Chưa có kết quả nộp nào cho nhiệm vụ này.</div>
                    ) : (
                      resultsForSelected.map(res => {
                        const unit = getUnitById(res.unit_id);
                        const submitter = getMemberById(res.submitted_by);
                        return (
                          <div
                            key={res.id}
                            onClick={() => {
                              setSelectedTask(null);
                              navigate('/duyet');
                            }}
                            className="p-3.5 flex items-center justify-between gap-3 hover:bg-blue-50/40 cursor-pointer transition-colors"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{unit?.name}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Người nộp: {submitter?.full_name} • Ngày: {formatDateVN(res.completed_at)}
                              </p>
                              {res.note && <p className="text-[11px] text-slate-600 mt-1 italic">"{res.note}"</p>}
                            </div>

                            <div className="flex items-center gap-3">
                              <ReviewStatusBadge status={res.status} />
                              <button
                                type="button"
                                className="px-2.5 py-1 text-xs font-semibold text-[#1F5FBF] bg-blue-50 rounded-lg hover:bg-blue-100 flex items-center gap-1"
                              >
                                Xem duyệt <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FORM TẠO NHIỆM VỤ DẠNG STEPPER 4 BƯỚC */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tạo mới Nhiệm vụ Thanh niên</h3>
                <p className="text-xs text-slate-500">Bước {step}/4: {step === 1 ? 'Thông tin chung' : step === 2 ? 'Chọn Chi đoàn' : step === 3 ? 'Gắn tiêu chí thi đua' : 'Xem lại & Phát động'}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress bar */}
            <div className="grid grid-cols-4 bg-slate-100 border-b border-slate-200 text-center text-xs font-semibold">
              <div className={`py-2 border-b-2 ${step >= 1 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'border-transparent text-slate-400'}`}>
                1. Thông tin
              </div>
              <div className={`py-2 border-b-2 ${step >= 2 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'border-transparent text-slate-400'}`}>
                2. Chi đoàn ({selectedUnitIds.length})
              </div>
              <div className={`py-2 border-b-2 ${step >= 3 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'border-transparent text-slate-400'}`}>
                3. Tiêu chí
              </div>
              <div className={`py-2 border-b-2 ${step >= 4 ? 'border-[#1F5FBF] text-[#1F5FBF] bg-white' : 'border-transparent text-slate-400'}`}>
                4. Xem lại
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
              {/* BƯỚC 1: THÔNG TIN */}
              {step === 1 && (
                <div className="space-y-3.5">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Tên nhiệm vụ (*):</label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={e => setFormTitle(e.target.value)}
                      placeholder="Ví dụ: Chiến dịch Tình nguyện Mùa hè xanh 2026..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs md:text-sm focus:outline-none focus:border-[#1F5FBF] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Nội dung triển khai:</label>
                    <textarea
                      rows={3}
                      value={formContent}
                      onChange={e => setFormContent(e.target.value)}
                      placeholder="Nội dung, kế hoạch chi tiết triển khai cho các chi đoàn..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF] focus:bg-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        Hạn chót hoàn thành (*) (Không cho chọn quá khứ):
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={formDueDate}
                        onChange={e => setFormDueDate(e.target.value)}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                      />
                    </div>

                    <div>
                      <label className="font-bold text-slate-800 block mb-1">Điểm tối đa:</label>
                      <input
                        type="number"
                        value={formMaxScore}
                        onChange={e => setFormMaxScore(Number(e.target.value))}
                        className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF] font-bold text-[#1F5FBF]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Phạm vi nộp minh chứng cá nhân:</label>
                    <select
                      value={formSubmitScope}
                      onChange={e => setFormSubmitScope(e.target.value as 'assigned' | 'open')}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                    >
                      <option value="assigned">Chỉ đoàn viên thuộc chi đoàn được giao</option>
                      <option value="open">Ai cũng tham gia được</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Chỉ tiêu đề ra:</label>
                    <input
                      type="text"
                      value={formTarget}
                      onChange={e => setFormTarget(e.target.value)}
                      placeholder="Ví dụ: 100% đoàn viên tham gia..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Tiêu chí đánh giá / Nghiệm thu:</label>
                    <input
                      type="text"
                      value={formEvaluationCriteria}
                      onChange={e => setFormEvaluationCriteria(e.target.value)}
                      placeholder="Ví dụ: Có hình ảnh nghiệm thu trước/sau..."
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  {/* Vị trí tùy chọn (khung bản đồ giả lập) */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-500" /> Vị trí định vị toạ độ hiện trường (tuỳ chọn):
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {formLat}, {formLng}
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        // Random slightly around Tan Phu
                        const newLat = 9.18 + Math.random() * 0.01;
                        const newLng = 105.15 + Math.random() * 0.01;
                        setFormLat(parseFloat(newLat.toFixed(4)));
                        setFormLng(parseFloat(newLng.toFixed(4)));
                        showToast({ title: 'Đã ghim toạ độ mới', type: 'info' });
                      }}
                      className="relative h-24 bg-blue-100/60 rounded-lg border border-blue-200 overflow-hidden flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                      title="Bấm vào bản đồ để chọn toạ độ ghim"
                    >
                      <div className="text-center space-y-1">
                        <MapPin className="w-6 h-6 text-rose-600 mx-auto animate-bounce" />
                        <span className="text-[11px] font-semibold text-slate-700">
                          Toạ độ trung tâm xã Hòa Bình: ({formLat}, {formLng})
                        </span>
                        <p className="text-[10px] text-slate-400">Nhấp để thay đổi vị trí ghim</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BƯỚC 2: CHỌN CHI ĐOÀN */}
              {step === 2 && (
                <div className="space-y-3">
                  {isUnitSecretary ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      Bạn là bí thư chi đoàn — nhiệm vụ chỉ được giao cho <b>chi đoàn của bạn</b>.
                    </div>
                  ) : (
                  <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900">
                      Đã chọn: <span className="text-[#1F5FBF]">{selectedUnitIds.length}</span> / {activeUnits.length} chi đoàn
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllUnits}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        {selectedUnitIds.length === activeUnits.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    </div>
                  </div>

                  {/* Chọn nhanh theo loại */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">Chọn theo loại:</span>
                    <button
                      type="button"
                      onClick={() => handleSelectByType('residential')}
                      className="px-2 py-0.5 rounded bg-blue-50 text-[#1F5FBF] font-semibold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                    >
                      Dân cư (25)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectByType('school')}
                      className="px-2 py-0.5 rounded bg-blue-50 text-[#1F5FBF] font-semibold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                    >
                      Trường học (3)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectByType('health')}
                      className="px-2 py-0.5 rounded bg-blue-50 text-[#1F5FBF] font-semibold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                    >
                      Y tế (2)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectByType('police')}
                      className="px-2 py-0.5 rounded bg-blue-50 text-[#1F5FBF] font-semibold border border-blue-200 hover:bg-blue-100 cursor-pointer"
                    >
                      Công an (1)
                    </button>
                  </div>
                  </>
                  )}

                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={unitSearch}
                      onChange={e => setUnitSearch(e.target.value)}
                      placeholder="Tìm kiếm chi đoàn..."
                      className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-[#1F5FBF]"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-white">
                    {(isUnitSecretary ? activeUnits.filter(u => u.id === myUnitId) : filteredStepUnits).map(unit => {
                      const isSelected = selectedUnitIds.includes(unit.id);
                      return (
                        <label
                          key={unit.id}
                          className={`flex items-center justify-between p-2 rounded-lg ${isUnitSecretary ? 'opacity-80' : 'hover:bg-slate-50 cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isUnitSecretary}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedUnitIds(prev => prev.filter(id => id !== unit.id));
                                } else {
                                  setSelectedUnitIds(prev => [...prev, unit.id]);
                                }
                              }}
                              className="rounded border-slate-300 text-[#1F5FBF] focus:ring-[#1F5FBF]"
                            />
                            <span className="font-semibold text-slate-800">{unit.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 capitalize">{unit.unit_type_id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* BƯỚC 3: TIÊU CHÍ (TUỲ CHỌN) */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <p className="text-slate-500">
                      Tích chọn các tiêu chí con được cộng điểm khi hoàn thành nhiệm vụ này:
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="text-xs font-bold text-[#1F5FBF] hover:underline cursor-pointer"
                    >
                      Bỏ qua, gán sau ›
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-3 border border-slate-200 rounded-xl p-3 bg-white">
                    {criteriaSections.map(sec => (
                      <div key={sec.id} className="space-y-2">
                        <h4 className="font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded">
                          {sec.name}
                        </h4>
                        <div className="space-y-1.5 pl-2">
                          {criteria
                            .filter(c => c.section_id === sec.id)
                            .map(crit => (
                              <div key={crit.id} className="space-y-1">
                                <span className="font-semibold text-slate-700 block text-[11px]">
                                  Tiêu chí {crit.stt}: {crit.name}
                                </span>
                                <div className="space-y-1 pl-2">
                                  {subCriteria
                                    .filter(sc => sc.criterion_id === crit.id)
                                    .map(sub => {
                                      const isChecked = subCriteriaContributions.some(
                                        c => c.sub_criterion_id === sub.id
                                      );
                                      const contrib = subCriteriaContributions.find(
                                        c => c.sub_criterion_id === sub.id
                                      );

                                      return (
                                        <div
                                          key={sub.id}
                                          className="p-2 rounded-lg border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2"
                                        >
                                          <label className="flex items-start gap-2 flex-1 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleSubCriterion(sub.id)}
                                              className="mt-0.5 rounded text-[#1F5FBF]"
                                            />
                                            <span className="text-slate-800 leading-snug">
                                              {sub.condition_text}
                                            </span>
                                          </label>

                                          {isChecked && (
                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className="text-slate-400 text-[10px]">Cộng:</span>
                                              <input
                                                type="number"
                                                min={1}
                                                max={sub.max_score}
                                                value={contrib?.contribution_score || 1}
                                                onChange={e =>
                                                  handleUpdateContributionScore(sub.id, Number(e.target.value))
                                                }
                                                className="w-14 p-1 bg-white border border-blue-300 rounded text-center font-bold text-[#1F5FBF]"
                                              />
                                              <span className="text-slate-400 text-[10px]">/ {sub.max_score}đ</span>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BƯỚC 4: XEM LẠI VÀ ĐĂNG */}
              {step === 4 && (
                <div className="space-y-3.5">
                  <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-[#1F5FBF]">Tóm tắt nhiệm vụ</span>
                    <h3 className="text-sm font-bold text-slate-900">{formTitle}</h3>
                    <p className="text-slate-600">{formContent}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100 text-slate-700">
                      <div>
                        <span className="text-slate-400">Hạn chót:</span> {formDueDate}
                      </div>
                      <div>
                        <span className="text-slate-400">Điểm tối đa:</span> {formMaxScore} điểm
                      </div>
                      <div>
                        <span className="text-slate-400">Số chi đoàn giao:</span> {selectedUnitIds.length} chi đoàn
                      </div>
                      <div>
                        <span className="text-slate-400">Tiêu chí con gắn:</span> {subCriteriaContributions.length} tiêu chí
                      </div>
                    </div>
                  </div>

                  {selectedUnitIds.length === 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-rose-700 font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      Chưa chọn chi đoàn nào! Không thể phát động nhiệm vụ.
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    Khi bấm <b>"Phát động ngay"</b>, hệ thống sẽ tự động gửi thông báo trực tiếp đến ứng dụng của Bí thư các Chi đoàn được giao.
                  </p>
                </div>
              )}
            </div>

            {/* Stepper Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((step - 1) as any)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Quay lại
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (step === 1 && !formTitle.trim()) {
                        showToast({ title: 'Vui lòng nhập tên nhiệm vụ', type: 'error' });
                        return;
                      }
                      setStep((step + 1) as any);
                    }}
                    className="inline-flex items-center gap-1 px-4 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
                  >
                    Tiếp theo <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveTask('draft')}
                      disabled={savingTask}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      {savingTask ? 'Đang lưu…' : 'Lưu nháp'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveTask('published')}
                      disabled={savingTask || selectedUnitIds.length === 0}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg cursor-pointer ${
                        selectedUnitIds.length === 0 || savingTask
                          ? 'bg-slate-400 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-700'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" /> {savingTask ? 'Đang phát động…' : 'Phát động ngay'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CLOSE TASK MODAL */}
      {closeConfirmTaskId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Xác nhận đóng nhiệm vụ</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn đóng tiếp nhận kết quả cho nhiệm vụ này? Các chi đoàn sẽ không thể nộp thêm báo cáo.
            </p>
            {loadingCloseInfo ? (
              <p className="text-[11px] text-slate-400">Đang kiểm tra tiến độ nộp bài...</p>
            ) : closeWarning && closeWarning.missing.length > 0 && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800 space-y-1">
                <p className="font-bold">
                  Còn {closeWarning.missing.length}/{closeWarning.assigned} chi đoàn chưa nộp bài tổng hợp:
                </p>
                <p>{closeWarning.missing.join(', ')}</p>
                <p className="text-rose-700">Đóng nhiệm vụ thì các chi đoàn này sẽ bị tính là chưa hoàn thành.</p>
              </div>
            )}

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
              Để xác nhận, gõ chính xác chữ <b>dong</b> vào ô bên dưới.
            </div>
            <input
              type="text"
              value={closeConfirmText}
              onChange={e => setCloseConfirmText(e.target.value)}
              placeholder="dong"
              className="w-full p-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setCloseConfirmTaskId(null); setCloseConfirmText(''); }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={closeConfirmText.trim().toLowerCase() !== 'dong' || closingTask}
                onClick={handleConfirmClose}
                className={`px-3 py-1.5 text-xs font-bold text-white rounded-lg ${
                  closeConfirmText.trim().toLowerCase() !== 'dong' || closingTask
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {closingTask ? 'Đang đóng…' : 'Đồng ý đóng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrTask && (
        <TaskQrModal taskId={qrTask.id} taskTitle={qrTask.title} onClose={() => setQrTask(null)} />
      )}

      {criteriaTaskId && (
        <TaskCriteriaModal taskId={criteriaTaskId} onClose={() => setCriteriaTaskId(null)} />
      )}
    </div>
  );
};
