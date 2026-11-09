import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  Target,
  ClipboardList,
  Users,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { formatDateVN } from '../mock/data';
import { exportExcel } from '../utils/exportExcel';
import { CreateTaskDropdown } from '../components/tasks/CreateTaskDropdown';

export const UnitReportPage: React.FC = () => {
  const {
    currentRole,
    currentMember,
    currentUser,
    units,
    tasks,
    taskResults,
    taskUnits,
    memberSubmissions,
    taskRegistrations,
    getUnitById,
    getMemberById,
    getTaskById,
    getUnitCriterionProgress,
    subCriteria,
    criteria,
    members,
    showToast,
  } = useApp();

  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin';
  const isSecretary = currentRole === 'unit_secretary';

  // Chọn chi đoàn: bí thư CĐ bị khóa vào chi đoàn mình, admin chọn được
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    currentMember?.unit_id || units[0]?.id || ''
  );

  const effectiveUnitId = isSecretary ? (currentMember?.unit_id ?? '') : selectedUnitId;

  const [kpis, setKpis] = useState<Array<{
    subCriterionId: string;
    criterionName: string;
    subName: string;
    maxScore: number;
    totalTasks: number;
    doneTasks: number;
    pendingTasks: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  const refreshKpis = async () => {
    if (!effectiveUnitId) { setKpis([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getUnitCriterionProgress(effectiveUnitId);
      setKpis(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshKpis();
    /* eslint-disable-next-line */
  }, [effectiveUnitId, getUnitCriterionProgress, subCriteria.length, tasks.length, taskResults.length]);

  const unit = getUnitById(effectiveUnitId);

  // Nhiệm vụ của chi đoàn này
  const unitTaskIds = useMemo(
    () => new Set(taskUnits.filter(tu => tu.unit_id === effectiveUnitId).map(tu => tu.task_id)),
    [taskUnits, effectiveUnitId]
  );

  const unitTasks = useMemo(() => {
    return tasks
      .filter(t => unitTaskIds.has(t.id))
      .map(task => {
        const results = taskResults.filter(r => r.task_id === task.id && r.unit_id === effectiveUnitId);
        const approved = results.filter(r => r.status === 'approved');
        const pending = results.filter(r => r.status === 'pending');
        const sourceSub = task.source_sub_criterion_id
          ? subCriteria.find(s => s.id === task.source_sub_criterion_id)
          : null;
        const sourceCriterion = sourceSub ? criteria.find(c => c.id === sourceSub.criterion_id) : null;
        return {
          task,
          results,
          approvedCount: approved.length,
          pendingCount: pending.length,
          sourceSub,
          sourceCriterion,
        };
      })
      .sort((a, b) => new Date(b.task.due_date).getTime() - new Date(a.task.due_date).getTime());
  }, [tasks, taskResults, unitTaskIds, effectiveUnitId, subCriteria, criteria]);

  // Đoàn viên trong chi đoàn + số bài họ đã nộp
  const unitMembers = useMemo(() => {
    return members
      .filter(m => m.unit_id === effectiveUnitId && m.is_active)
      .map(m => {
        const subs = memberSubmissions.filter(ms => ms.member_id === m.id);
        return {
          member: m,
          submitted: subs.length,
          approved: subs.filter(s => s.status === 'approved').length,
          pending: subs.filter(s => s.status === 'pending').length,
        };
      })
      .sort((a, b) => b.approved - a.approved);
  }, [members, memberSubmissions, effectiveUnitId]);

  // Tổng hợp
  const summary = useMemo(() => {
    const totalKpi = kpis.length;
    const doneKpi = kpis.filter(k => k.totalTasks > 0 && k.doneTasks >= k.totalTasks).length;
    const withTasks = kpis.filter(k => k.totalTasks > 0).length;
    const totalTasks = unitTasks.length;
    const approvedTasks = unitTasks.filter(t => t.approvedCount > 0).length;
    const activeMembers = unitMembers.length;
    const submittedMembers = unitMembers.filter(m => m.submitted > 0).length;
    return { totalKpi, doneKpi, withTasks, totalTasks, approvedTasks, activeMembers, submittedMembers };
  }, [kpis, unitTasks, unitMembers]);

  const handleExport = async () => {
    if (!unit) return;
    await exportExcel({
      fileName: `Bao_cao_chi_doan_${unit.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: 'Tổng hợp',
      title: `BÁO CÁO TỔNG HỢP CHI ĐOÀN ${unit.name.toUpperCase()}`,
      columns: [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tiêu chí', key: 'criterion', width: 26 },
        { header: 'Nội dung', key: 'sub', width: 40 },
        { header: 'Điểm tối đa', key: 'max', width: 12 },
        { header: 'Số nhiệm vụ', key: 'total', width: 12 },
        { header: 'Đã duyệt', key: 'done', width: 11 },
        { header: 'Chờ duyệt', key: 'pending', width: 11 },
        { header: 'Trạng thái', key: 'status', width: 18 },
      ],
      rows: kpis.map((k, i) => ({
        stt: i + 1,
        criterion: k.criterionName,
        sub: k.subName,
        max: k.maxScore,
        total: k.totalTasks,
        done: k.doneTasks,
        pending: k.pendingTasks,
        status: k.totalTasks === 0
          ? 'Chưa tạo nhiệm vụ'
          : k.doneTasks >= k.totalTasks
            ? 'Đã hoàn thành'
            : `${Math.round((k.doneTasks / k.totalTasks) * 100)}%`,
      })),
    });
    showToast({ title: 'Đã xuất báo cáo chi đoàn', type: 'success' });
  };

  if (!effectiveUnitId) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Tài khoản chưa gắn với chi đoàn nào.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tổng hợp báo cáo…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#1F5FBF]" />
            Báo cáo chi đoàn
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp tiêu chí được Đoàn xã giao, nhiệm vụ đã triển khai và tiến độ nộp minh chứng của đoàn viên.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              value={selectedUnitId}
              onChange={e => setSelectedUnitId(e.target.value)}
              title="Chọn chi đoàn cần xem báo cáo"
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
            >
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleExport}
            title="Xuất báo cáo tổng hợp ra file Excel để nộp Đoàn xã"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-[#1F5FBF]" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Thẻ tổng quan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <Target className="w-3.5 h-3.5 text-[#1F5FBF]" /> Tiêu chí được giao
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{summary.totalKpi}</p>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            {summary.doneKpi} đã hoàn thành · {summary.withTasks} đã có nhiệm vụ
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <ClipboardList className="w-3.5 h-3.5 text-blue-600" /> Nhiệm vụ
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{summary.totalTasks}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{summary.approvedTasks} đã có bài duyệt</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <Users className="w-3.5 h-3.5 text-emerald-600" /> Đoàn viên
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{summary.activeMembers}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{summary.submittedMembers} đã nộp minh chứng</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tỷ lệ tiêu chí
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {summary.totalKpi > 0 ? Math.round((summary.doneKpi / summary.totalKpi) * 100) : 0}%
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">theo số tiêu chí đã hoàn thành</p>
        </div>
      </div>

      {/* Bảng tiêu chí được giao */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#1F5FBF]" />
            Tiêu chí Đoàn xã giao ({kpis.length})
          </h2>
        </div>

        {kpis.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chi đoàn chưa được giao tiêu chí nào trong bộ tiêu chí hiện hành.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Tiêu chí</th>
                  <th className="text-center px-2 py-2 font-semibold">Điểm</th>
                  <th className="text-center px-2 py-2 font-semibold">Nhiệm vụ</th>
                  <th className="text-center px-2 py-2 font-semibold">Đã duyệt</th>
                  <th className="text-center px-2 py-2 font-semibold">Chờ duyệt</th>
                  <th className="text-center px-2 py-2 font-semibold">Tiến độ</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kpis.map(k => {
                  const pct = k.totalTasks > 0 ? Math.round((k.doneTasks / k.totalTasks) * 100) : 0;
                  const done = k.totalTasks > 0 && k.doneTasks >= k.totalTasks;
                  const noTask = k.totalTasks === 0;
                  return (
                    <tr key={k.subCriterionId} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-semibold text-[#1F5FBF] bg-blue-50 px-1.5 py-0.5 rounded block w-fit mb-0.5">
                          {k.criterionName}
                        </span>
                        <span className="text-slate-800">{k.subName}</span>
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-amber-700">{k.maxScore}</td>
                      <td className="px-2 py-2 text-center font-semibold text-slate-800">{k.totalTasks}</td>
                      <td className="px-2 py-2 text-center font-bold text-emerald-700">{k.doneTasks}</td>
                      <td className="px-2 py-2 text-center font-semibold text-amber-700">{k.pendingTasks}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-[#1F5FBF]'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${noTask ? 'text-rose-600' : done ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {noTask ? 'Chưa tạo' : `${pct}%`}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <CreateTaskDropdown
                          subCriterionId={k.subCriterionId}
                          subName={k.subName}
                          maxScore={k.maxScore}
                          unitId={effectiveUnitId}
                          onCreated={() => { void refreshKpis(); }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bảng nhiệm vụ */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            Nhiệm vụ của chi đoàn ({unitTasks.length})
          </h2>
        </div>

        {unitTasks.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chi đoàn chưa có nhiệm vụ nào.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Nhiệm vụ</th>
                  <th className="text-left px-2 py-2 font-semibold">Tiêu chí nguồn</th>
                  <th className="text-center px-2 py-2 font-semibold">Hạn chót</th>
                  <th className="text-center px-2 py-2 font-semibold">Đã duyệt</th>
                  <th className="text-center px-2 py-2 font-semibold">Chờ duyệt</th>
                  <th className="text-center px-2 py-2 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitTasks.map(({ task, approvedCount, pendingCount, sourceSub }) => {
                  const overdue = new Date(task.due_date).getTime() < Date.now() && approvedCount === 0;
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-semibold text-slate-800 max-w-xs">
                        <span className="line-clamp-2">{task.title}</span>
                      </td>
                      <td className="px-2 py-2 text-slate-600 max-w-[200px]">
                        {sourceSub ? (
                          <span className="line-clamp-2 text-[11px]">{sourceSub.condition_text}</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Không gắn tiêu chí</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600 whitespace-nowrap">
                        {formatDateVN(task.due_date)}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-emerald-700">{approvedCount}</td>
                      <td className="px-2 py-2 text-center font-semibold text-amber-700">{pendingCount}</td>
                      <td className="px-2 py-2 text-center">
                        {approvedCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Đã duyệt
                          </span>
                        ) : pendingCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" /> Chờ duyệt
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <AlertTriangle className="w-3 h-3" /> Quá hạn
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Chưa nộp
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bảng đoàn viên */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            Đoàn viên trong chi đoàn ({unitMembers.length})
          </h2>
        </div>

        {unitMembers.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Chi đoàn chưa có đoàn viên đang hoạt động.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Đoàn viên</th>
                  <th className="text-center px-2 py-2 font-semibold">Đã nộp</th>
                  <th className="text-center px-2 py-2 font-semibold">Đã duyệt</th>
                  <th className="text-center px-2 py-2 font-semibold">Chờ duyệt</th>
                  <th className="text-center px-2 py-2 font-semibold">Đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitMembers.map(({ member, submitted, approved, pending }) => (
                  <tr key={member.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-semibold text-slate-800">{member.full_name}</td>
                    <td className="px-2 py-2 text-center font-semibold">{submitted}</td>
                    <td className="px-2 py-2 text-center font-bold text-emerald-700">{approved}</td>
                    <td className="px-2 py-2 text-center font-semibold text-amber-700">{pending}</td>
                    <td className="px-2 py-2 text-center">
                      {submitted === 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Chưa tham gia
                        </span>
                      ) : approved > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Tích cực
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          Đang chờ
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};