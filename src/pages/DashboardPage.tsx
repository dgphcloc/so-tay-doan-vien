import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { isAdminLevel } from '../utils/permissions';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  AlertOctagon,
  Clock,
  UserPlus,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  X,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import { DeadlineWarningBadge, ReviewStatusBadge } from '../components/common/StatusBadge';
import { formatDateVN, formatDateTimeVN } from '../mock/data';
import { Unit } from '../types';

export const DashboardPage: React.FC = () => {
  const {
    currentRole,
    currentMember,
    pendingCount,
    taskResults,
    tasks,
    taskUnits,
    units,
    members,
    warnings,
    auditLogs,
    yearlySettings,
    overdueUnitsCount,
    dueSoon7DaysCount,
    newMembersCount,
    lastUpdated,
    refreshData,
    getUnitById,
    getMemberById,
    getTaskById,
    calculateUnitScores,
  } = useApp();

  const navigate = useNavigate();

  const isUnitSecretary = currentRole === 'unit_secretary';
  // Điểm thi đua: chỉ bí thư chi đoàn và bí thư xã/staff xem được. Đoàn viên không xem.
  const canViewScores = currentRole !== 'member';
  // Nhật ký hệ thống: chỉ bí thư xã / cán bộ xã / super admin xem.
  // Bí thư chi đoàn và đoàn viên không thấy khối này.
  const canViewLogs = isAdminLevel(currentRole) || currentRole === 'staff';

  // State
  const [chartView, setChartView] = useState<'top10' | 'bottom5'>('top10');
  const [isGridExpanded, setIsGridExpanded] = useState<boolean>(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  // 1. Cần xử lý (5 mục chờ duyệt mới nhất)
  const pendingItems = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'task_result' | 'criterion_submission';
      title: string;
      unitName: string;
      date: string;
      submitterName: string;
      rawDate: string;
    }> = [];

    taskResults
      .filter(r => r.status === 'pending')
      .forEach(r => {
        const task = getTaskById(r.task_id);
        const unit = getUnitById(r.unit_id);
        const submitter = getMemberById(r.submitted_by);
        list.push({
          id: r.id,
          type: 'task_result',
          title: task?.title || 'Báo cáo kết quả nhiệm vụ',
          unitName: unit?.name || 'Chi đoàn',
          date: r.completed_at,
          rawDate: r.completed_at,
          submitterName: submitter?.full_name || 'Đoàn viên',
        });
      });

    return list.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime()).slice(0, 5);
  }, [taskResults, getTaskById, getUnitById, getMemberById]);

  // 2. Sắp trễ / Quá hạn (danh sách chi đoàn chưa nộp xếp theo hạn)
  const urgentUnits = useMemo(() => {
    const list: Array<{
      id: string;
      unitId: string;
      unitName: string;
      taskOrCritName: string;
      dueDate: string;
      isOverdue: boolean;
      daysDiff: number;
    }> = [];

    const nowTime = new Date().getTime();

    // Bí thư chi đoàn: chỉ tính cho chi đoàn mình
    const scopeUnitId = isUnitSecretary ? currentMember?.unit_id ?? null : null;

    // Duyệt qua các nhiệm vụ đang chạy
    tasks
      .filter(t => t.status === 'published')
      .forEach(t => {
        const assignedUnitIds = taskUnits.filter(tu => tu.task_id === t.id).map(tu => tu.unit_id);
        const dueTime = new Date(t.due_date).getTime();
        const diffDays = Math.ceil((dueTime - nowTime) / (1000 * 60 * 60 * 24));

        assignedUnitIds.forEach(uId => {
          if (scopeUnitId && uId !== scopeUnitId) return;
          // Kiểm tra xem đã nộp chưa
          const hasResult = taskResults.some(r => r.task_id === t.id && r.unit_id === uId);
          if (!hasResult) {
            const unit = getUnitById(uId);
            list.push({
              id: `${t.id}_${uId}`,
              unitId: uId,
              unitName: unit?.name || uId,
              taskOrCritName: t.title,
              dueDate: t.due_date,
              isOverdue: diffDays < 0,
              daysDiff: diffDays,
            });
          }
        });
      });

    // Sắp xếp: quá hạn lên đầu (diffDays nhỏ nhất lên đầu), tiếp theo là sắp đến hạn
    return list.sort((a, b) => a.daysDiff - b.daysDiff).slice(0, 7);
  }, [tasks, taskUnits, taskResults, getUnitById, isUnitSecretary, currentMember]);

  // 3. Tiến độ nhiệm vụ đang chạy (thanh tiến độ ngang: đã nộp / được giao)
  const activeTasksProgress = useMemo(() => {
    return tasks
      .filter(t => t.status === 'published')
      .map(task => {
        const assigned = taskUnits.filter(tu => tu.task_id === task.id);
        const assignedCount = assigned.length;
        const submittedCount = taskResults.filter(
          tr => tr.task_id === task.id && (tr.status === 'approved' || tr.status === 'pending')
        ).length;
        const percent = assignedCount > 0 ? Math.round((submittedCount / assignedCount) * 100) : 0;
        return {
          task,
          assignedCount,
          submittedCount,
          percent,
        };
      });
  }, [tasks, taskUnits, taskResults]);

  // 4. Biểu đồ Điểm chi đoàn (Top 10 / Cuối 5)
  const unitScores = useMemo(() => {
    const scores = calculateUnitScores();
    scores.sort((a, b) => b.totalScore - a.totalScore);
    if (chartView === 'top10') {
      return scores.slice(0, 10).map(s => ({
        name: s.unit.name.replace('Chi đoàn ', ''),
        fullName: s.unit.name,
        score: s.totalScore,
        max: s.maxPossible,
        unit: s.unit,
      }));
    } else {
      return scores
        .slice(-5)
        .reverse()
        .map(s => ({
          name: s.unit.name.replace('Chi đoàn ', ''),
          fullName: s.unit.name,
          score: s.totalScore,
          max: s.maxPossible,
          unit: s.unit,
        }));
    }
  }, [calculateUnitScores, chartView]);

  // 5. Lưới chi đoàn × việc (đang chạy hoặc tiêu chí con sắp hạn)
  // Các cột việc chính: 3 task published + 2 tiêu chí con gần nhất
  const gridColumns = useMemo(() => {
    const cols: Array<{
      id: string;
      title: string;
      type: 'task' | 'sub_criterion';
      deadline: string;
    }> = [];

    tasks
      .filter(t => t.status === 'published')
      .forEach(t => {
        cols.push({
          id: t.id,
          title: t.title,
          type: 'task',
          deadline: t.due_date,
        });
      });

    return cols;
  }, [tasks]);

  // Helper cho ô trong lưới
  const getCellStatus = (unitId: string, col: { id: string; type: 'task' | 'sub_criterion'; deadline: string }) => {
    if (col.type === 'task') {
      const isAssigned = taskUnits.some(tu => tu.task_id === col.id && tu.unit_id === unitId);
      if (!isAssigned) {
        return { label: '—', color: 'bg-slate-100 text-slate-400 border-slate-200' };
      }
      const res = taskResults.find(tr => tr.task_id === col.id && tr.unit_id === unitId);
      if (res) {
        if (res.status === 'approved') {
          return { label: 'Đã nộp', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
        }
        if (res.status === 'pending') {
          return { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-800 border-amber-200' };
        }
        if (res.status === 'rejected') {
          return { label: 'Từ chối', color: 'bg-rose-100 text-rose-800 border-rose-200' };
        }
      }
      // Chưa nộp
      const isOverdue = new Date(col.deadline) < new Date();
      if (isOverdue) {
        return { label: 'Trễ', color: 'bg-red-100 text-red-800 border-red-200' };
      }
      return { label: 'Sắp hạn', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    }
    return { label: '—', color: 'bg-slate-100 text-slate-400 border-slate-200' };
  };

  // Chi đoàn details
  const unitSecretary = selectedUnit ? members.find(m => m.unit_id === selectedUnit.id && m.current_position === 'secretary') : null;
  const isStaff = currentRole === 'staff';

  return (
    <div className="space-y-6">
      {/* Header dòng đầu: Tiêu đề + Làm mới */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Tổng quan Công tác Đoàn – Năm {yearlySettings.year}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Theo dõi tiến độ, đôn đốc chỉ tiêu và phê duyệt minh chứng số hoá Đoàn cơ sở
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <span className="text-xs text-slate-500 font-medium">Cập nhật lúc {lastUpdated}</span>
          <button
            type="button"
            onClick={refreshData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            Làm mới
          </button>
        </div>
      </div>

      {/* 1) Hàng 4 thẻ số */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Chờ duyệt */}
        <div
          onClick={() => {
            if (currentRole !== 'staff') navigate('/duyet');
          }}
          className={`bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs transition-all ${
            currentRole !== 'staff' ? 'hover:border-blue-400 hover:shadow-md cursor-pointer' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chờ duyệt</span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-slate-900">{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                Cần xử lý
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-2 flex items-center justify-between">
            <span>Gồm kết quả & điểm tự chấm</span>
            {currentRole !== 'staff' && <ArrowUpRight className="w-3.5 h-3.5 text-[#1F5FBF]" />}
          </p>
        </div>

        {/* Thẻ 2: Chi đoàn trễ hạn — đoàn viên không xem (yêu cầu nghiệp vụ) */}
        {canViewScores && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isUnitSecretary ? 'Việc trễ hạn của chi đoàn' : 'Chi đoàn trễ hạn'}
            </span>
            <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            {isUnitSecretary ? (
              <>
                <span className="text-2xl md:text-3xl font-extrabold text-red-600">
                  {urgentUnits.filter(u => u.isOverdue).length}
                </span>
                <span className="text-xs font-medium text-slate-500">việc quá hạn</span>
              </>
            ) : (
              <>
                <span className="text-2xl md:text-3xl font-extrabold text-red-600">{overdueUnitsCount}</span>
                <span className="text-xs font-medium text-slate-500">/ {units.length} chi đoàn</span>
              </>
            )}
          </div>
          <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
            {isUnitSecretary ? 'Cần hoàn thành và nộp minh chứng' : 'Cần phát thông báo nhắc nhở'}
          </p>
        </div>
        )}

        {/* Thẻ 3: Sắp đến hạn 7 ngày */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sắp đến hạn 7 ngày</span>
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl md:text-3xl font-extrabold text-amber-600">{dueSoon7DaysCount}</span>
            <span className="text-xs font-medium text-slate-500">mục công việc</span>
          </div>
          <p className="text-xs text-amber-700 font-medium mt-2 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            1 nhiệm vụ + 1 tiêu chí con
          </p>
        </div>

        {/* Thẻ 4: Đoàn viên mới trong năm kèm tiến độ */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đoàn viên mới</span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1F5FBF] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-extrabold text-[#1F5FBF]">{newMembersCount}</span>
              <span className="text-xs font-medium text-slate-500">/ {yearlySettings.new_member_target} chỉ tiêu</span>
            </div>
            <span className="text-xs font-bold text-slate-700">
              {Math.round((newMembersCount / yearlySettings.new_member_target) * 100)}%
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2.5 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#1F5FBF] h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (newMembersCount / yearlySettings.new_member_target) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 2) Hai cột: Cần xử lý & Sắp trễ / quá hạn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái: Cần xử lý (5 mục chờ duyệt mới nhất) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#1F5FBF]" />
              <h2 className="text-sm md:text-base font-bold text-slate-800">Cần xử lý ({pendingCount})</h2>
            </div>
            {currentRole !== 'staff' && (
              <Link
                to="/duyet"
                className="text-xs font-semibold text-[#1F5FBF] hover:underline inline-flex items-center gap-1"
              >
                Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {pendingItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">Không có hồ sơ nào đang chờ duyệt.</div>
            ) : (
              pendingItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (currentRole !== 'staff') navigate('/duyet');
                  }}
                  className={`py-3 flex items-start justify-between gap-3 group transition-colors ${
                    currentRole !== 'staff' ? 'cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 rounded-lg' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate group-hover:text-[#1F5FBF] transition-colors">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{item.unitName}</span>
                      <span>•</span>
                      <span>Người gửi: {item.submitterName}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Chờ duyệt
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDateVN(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cột phải: Sắp trễ / quá hạn */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <h2 className="text-sm md:text-base font-bold text-slate-800">Sắp trễ / Quá hạn</h2>
            </div>
            <span className="text-xs font-medium text-slate-400">Ưu tiên xử lý</span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {urgentUnits.map(item => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.isOverdue
                          ? 'bg-red-500 ring-2 ring-red-100'
                          : item.daysDiff <= 3
                          ? 'bg-orange-500 ring-2 ring-orange-100'
                          : 'bg-amber-400 ring-2 ring-amber-100'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-800 truncate">{item.unitName}</span>
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5 ml-4.5">{item.taskOrCritName}</p>
                </div>
                <div className="shrink-0">
                  <DeadlineWarningBadge dueDate={item.dueDate} isOverdue={item.isOverdue} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3) Hai cột: Tiến độ nhiệm vụ đang chạy & Biểu đồ Điểm chi đoàn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cột trái: Tiến độ nhiệm vụ đang chạy */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1F5FBF]" />
              <h2 className="text-sm md:text-base font-bold text-slate-800">Tiến độ nhiệm vụ đang chạy</h2>
            </div>
            <Link to="/nhiem-vu" className="text-xs font-semibold text-[#1F5FBF] hover:underline">
              Chi tiết
            </Link>
          </div>

          <div className="space-y-4 flex-1">
            {activeTasksProgress.map(({ task, assignedCount, submittedCount, percent }) => (
              <div key={task.id} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs md:text-sm font-bold text-slate-800">{task.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <DeadlineWarningBadge dueDate={task.due_date} />
                      <span className="text-[11px] text-slate-500">Hạn: {formatDateVN(task.due_date)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs md:text-sm font-extrabold text-[#1F5FBF]">
                      {submittedCount}/{assignedCount}
                    </span>
                    <p className="text-[10px] text-slate-400">chi đoàn đã nộp</p>
                  </div>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-[#1F5FBF]' : 'bg-amber-500'
                    }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cột phải: Biểu đồ cột NGANG "Điểm chi đoàn" — đoàn viên không xem được */}
        {!canViewScores ? (
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col items-center justify-center text-center min-h-[18rem]">
            <Building2 className="w-8 h-8 text-slate-300 mb-2" />
            <h2 className="text-sm font-bold text-slate-700">Điểm thi đua của chi đoàn</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Chỉ bí thư chi đoàn và bí thư Đoàn xã xem được điểm thi đua. Liên hệ bí thư chi đoàn nếu cần biết.
            </p>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#1F5FBF]" />
                <h2 className="text-sm md:text-base font-bold text-slate-800">Điểm chi đoàn (2026)</h2>
              </div>

              {/* Toggle Top 10 / Cuối 5 */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setChartView('top10')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    chartView === 'top10' ? 'bg-white text-[#1F5FBF] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Top 10
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('bottom5')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    chartView === 'bottom5' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cuối 5
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-2">Bấm vào thanh biểu đồ để xem chi tiết chi đoàn</p>

            <div className="h-64 sm:h-72 w-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={unitScores}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                  onClick={(data: any) => {
                    if (data && (data as any).activePayload && (data as any).activePayload[0]) {
                      const unitObj = (data as any).activePayload[0].payload.unit as Unit;
                      setSelectedUnit(unitObj);
                    }
                  }}
                >
                  <XAxis type="number" domain={[0, 60]} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} điểm`, 'Tổng điểm']}
                    labelFormatter={(label: any, payload: any) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullName;
                      }
                      return label;
                    }}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <ReferenceLine x={50} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Mốc 50đ', fill: '#10b981', fontSize: 10, position: 'top' }} />
                  <Bar dataKey="score" radius={[0, 6, 6, 0]} cursor="pointer">
                    {unitScores.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={chartView === 'top10' ? (entry.score >= 50 ? '#1F5FBF' : '#3b82f6') : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 4) "Lưới chi đoàn × việc" (thu gọn mặc định) */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => setIsGridExpanded(!isGridExpanded)}
          className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#1F5FBF]" />
            <div>
              <h2 className="text-sm md:text-base font-bold text-slate-800">
                Ma trận theo dõi: Lưới Chi đoàn × Việc ({units.length} chi đoàn)
              </h2>
              <p className="text-xs text-slate-500">
                Theo dõi trực quan trạng thái thực hiện các nhiệm vụ đang chạy và tiêu chí con sắp đến hạn
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              {isGridExpanded ? 'Thu gọn' : 'Mở rộng'}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                isGridExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {isGridExpanded && (
          <div className="p-4 pt-0 border-t border-slate-100">
            {/* Chú thích màu sắc */}
            <div className="flex flex-wrap items-center gap-3 py-3 text-xs text-slate-600 border-b border-slate-100 mb-3">
              <span className="font-semibold text-slate-500">Chú giải:</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                Đã nộp / Đã duyệt
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold">
                Chờ duyệt
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[11px] font-semibold">
                Sắp hạn
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-semibold">
                Trễ / Quá hạn
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[11px] font-semibold">
                — Không giao
              </span>
            </div>

            {/* Bảng cuộn ngang trong khung riêng */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-20 text-slate-700 uppercase font-bold border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="p-3 sticky left-0 bg-slate-50 z-30 min-w-44 border-r border-slate-200">
                      Chi đoàn cơ sở
                    </th>
                    {gridColumns.map(col => (
                      <th key={col.id} className="p-3 min-w-48 text-center border-r border-slate-200">
                        <div className="line-clamp-1 text-slate-900 font-bold" title={col.title}>
                          {col.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          Hạn: {formatDateVN(col.deadline)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {units.map(unit => (
                    <tr key={unit.id} className="hover:bg-blue-50/30 transition-colors">
                      <td
                        onClick={() => setSelectedUnit(unit)}
                        className="p-2.5 font-bold text-slate-900 sticky left-0 bg-white hover:text-[#1F5FBF] cursor-pointer z-10 border-r border-slate-200 shadow-xs"
                      >
                        {unit.name}
                      </td>
                      {gridColumns.map(col => {
                        const cell = getCellStatus(unit.id, col);
                        return (
                          <td key={col.id} className="p-2 text-center border-r border-slate-200">
                            <span
                              className={`inline-block px-2.5 py-1 text-[11px] font-bold rounded-md border ${cell.color}`}
                            >
                              {cell.label}
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
      </div>

      {/* 5) "Hoạt động gần đây" — chỉ bí thư xã / cán bộ xã xem được */}
      {canViewLogs && (
      <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1F5FBF]" />
            <h2 className="text-sm md:text-base font-bold text-slate-800">Hoạt động gần đây</h2>
          </div>
          <span className="text-xs text-slate-400">10 sự kiện mới nhất</span>
        </div>

        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
          {auditLogs.slice(0, 10).map((log, index) => {
            const actor = getMemberById(log.actor_id);
            return (
              <div key={log.id} className="relative flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <span className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-[#1F5FBF] ring-4 ring-blue-50" />
                <div className="text-xs text-slate-700">
                  <span className="font-bold text-slate-900">{log.action}</span>
                  <span className="text-slate-400 mx-1.5">•</span>
                  <span className="text-slate-600">{log.new_value}</span>
                  <span className="text-slate-400 mx-1.5">bởi</span>
                  <span className="font-semibold text-[#1F5FBF]">{actor?.full_name || 'Bí thư Đoàn'}</span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                  {formatDateTimeVN(log.created_at)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Chi tiết Chi đoàn Modal / Slide-over khi bấm vào biểu đồ hoặc ma trận */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1F5FBF] bg-blue-50 px-2 py-0.5 rounded">
                  Chi đoàn cơ sở
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedUnit.name}</h3>
                <p className="text-xs text-slate-500">{selectedUnit.note || 'Xã Hòa Bình'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block font-medium">Số lượng đoàn viên</span>
                <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">
                  {selectedUnit.union_member_count} đoàn viên
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block font-medium">Số thanh niên quản lý</span>
                <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">
                  {selectedUnit.youth_count} thanh niên
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Bí thư Chi đoàn:</span>
                {unitSecretary ? (
                  <span className="font-bold text-slate-900">{unitSecretary.full_name}</span>
                ) : (
                  <span className="font-bold text-rose-600 inline-flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Khuyết Bí thư
                  </span>
                )}
              </div>
              {unitSecretary && (
                <div className="flex items-center justify-between text-slate-600">
                  <span>Số điện thoại:</span>
                  <span className="font-medium">
                    {isStaff
                      ? unitSecretary.phone.substring(0, 3) + '******' + unitSecretary.phone.substring(9)
                      : unitSecretary.phone}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUnit(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedUnit(null);
                  navigate('/doan-vien');
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Xem danh sách đoàn viên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
