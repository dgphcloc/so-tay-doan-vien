import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  Download,
  FileText,
  CheckCircle2,
  TrendingUp,
  Users,
  Award,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  PieChart as PieChartIcon,
  Layers,
  Building2,
  Printer,
  Sparkles,
  ClipboardList,
  AlertTriangle,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { Report, ReportType } from '../types';
import { formatDateVN, formatDateTimeVN } from '../mock/data';
import { exportExcel } from '../utils/exportExcel';
import { exportPdf } from '../utils/exportPdf';
import { calculateAge, isMemberMatured } from '../utils/vietnamese';

const RANK_COLORS = {
  excellent: '#10B981', // Xanh lá - Xuất sắc
  good: '#1F5FBF',      // Xanh dương - Tốt
  fair: '#F59E0B',      // Vàng cam - Khá
  average: '#EF4444',   // Đỏ - Trung bình
};

export const ReportsPage: React.FC = () => {
  const {
    reports,
    units,
    members,
    tasks,
    taskResults,
    taskUnits,
    taskSubCriteria,
    taskRegistrations,
    memberSubmissions,
    yearlySettings,
    calculateUnitScores,
    createReportSnapshot,
    getUnitById,
    refreshData,
    showToast,
  } = useApp();

  // Active view: 'reports_list' | 'ranking_dashboard' | 'personnel'
  const [activeTab, setActiveTab] = useState<'reports_list' | 'ranking_dashboard' | 'personnel' | 'participation'>('reports_list');

  // Stepper Modal "Tạo báo cáo mới"
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State for Create Report
  const [reportType, setReportType] = useState<ReportType>('quarterly');
  const [reportTitle, setReportTitle] = useState('Báo cáo Công tác Đoàn & Phong trào TTN Quý III/2026');
  const [periodStart, setPeriodStart] = useState('2026-07-01');
  const [periodEnd, setPeriodEnd] = useState('2026-09-30');
  const [reportScope, setReportScope] = useState<'all' | string>('all');

  // Step 2: Included Sections
  const [includeTaskProgress, setIncludeTaskProgress] = useState(true);
  const [includeCriteriaScores, setIncludeCriteriaScores] = useState(true);
  const [includeMemberDynamics, setIncludeMemberDynamics] = useState(true);
  const [includeUnitRankings, setIncludeUnitRankings] = useState(true);

  // Selected report for detail preview modal
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Sắp xếp bảng xếp loại: bấm tiêu đề cột để đổi
  // 'with_criteria' = chỉ đếm nhiệm vụ có gắn tiêu chí (mặc định); 'all' = mọi nhiệm vụ
  const [taskScope, setTaskScope] = useState<'with_criteria' | 'all'>('with_criteria');

  /** Mức độ tham gia của đoàn viên: bấm tham gia so với thực tế nộp bài. */
  const participationStats = useMemo(() => {
    const activeMembers = members.filter(m => m.is_active);
    const regMap = new Map<string, boolean>();
    for (const r of taskRegistrations) regMap.set(`${r.task_id}_${r.member_id}`, r.is_joining);
    const subMap = new Set(memberSubmissions.map(s => `${s.task_id}_${s.member_id}`));

    // Theo từng đoàn viên
    const perMember = activeMembers.map(m => {
      let joined = 0, submitted = 0, approved = 0;
      for (const t of tasks) {
        if (regMap.get(`${t.id}_${m.id}`) === true) joined += 1;
        if (subMap.has(`${t.id}_${m.id}`)) {
          submitted += 1;
          const sub = memberSubmissions.find(x => x.task_id === t.id && x.member_id === m.id);
          if (sub?.status === 'approved') approved += 1;
        }
      }
      return { member: m, joined, submitted, approved };
    });

    const totalJoined = perMember.reduce((s, x) => s + x.joined, 0);
    const totalSubmitted = perMember.reduce((s, x) => s + x.submitted, 0);
    const neverJoined = perMember.filter(x => x.joined === 0 && x.submitted === 0);
    const topActive = [...perMember].sort((a, b) => b.approved - a.approved || b.submitted - a.submitted).slice(0, 10);

    // Theo chi đoàn: tỷ lệ tham gia
    const perUnit = units
      .filter(u => u.is_active)
      .map(u => {
        const inUnit = perMember.filter(x => x.member.unit_id === u.id);
        const members_count = inUnit.length;
        const joined = inUnit.reduce((s, x) => s + x.joined, 0);
        const submitted = inUnit.reduce((s, x) => s + x.submitted, 0);
        const approved = inUnit.reduce((s, x) => s + x.approved, 0);
        const active = inUnit.filter(x => x.submitted > 0).length;
        return {
          unit: u,
          members_count,
          joined,
          submitted,
          approved,
          activeMembers: active,
          rate: members_count > 0 ? Math.round((active / members_count) * 100) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    // Tỷ lệ bấm tham gia nhưng không nộp bài
    const joinButNoSubmit = Math.max(0, totalJoined - totalSubmitted);

    return { perMember, perUnit, neverJoined, topActive, totalJoined, totalSubmitted, joinButNoSubmit };
  }, [members, tasks, taskRegistrations, memberSubmissions, units]);

  /** Số liệu nhân sự: tính từ members + unitCommittees (có sẵn trong context). */
  const personnelStats = useMemo(() => {
    const active = members.filter(m => m.is_active);
    const today = new Date();

    // Nhóm tuổi
    const groups = { under18: 0, from18to25: 0, from26to30: 0, over30: 0 };
    // Trưởng thành trong 12 tháng tới (tuổi sẽ đủ mức trong vòng 1 năm)
    const upcomingMatured: Array<{ name: string; unit: string; monthsLeft: number }> = [];
    // Mới kết nạp theo tháng (12 tháng gần nhất)
    const monthlyJoin: Array<{ month: string; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      monthlyJoin.push({ month: `${d.getMonth() + 1}/${d.getFullYear()}`, count: 0 });
    }
    const maturedAge = yearlySettings.matured_age ?? 30;

    for (const m of active) {
      const age = calculateAge(m.birth_date);
      if (age < 18) groups.under18 += 1;
      else if (age <= 25) groups.from18to25 += 1;
      else if (age <= 30) groups.from26to30 += 1;
      else groups.over30 += 1;

      // Tuổi sau 12 tháng: nếu đủ mức mà hiện tại chưa đủ thì báo trước
      const birthNext = new Date(m.birth_date);
      birthNext.setFullYear(birthNext.getFullYear() + maturedAge);
      const monthsLeft = Math.ceil((birthNext.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.4375));
      if (monthsLeft >= 0 && monthsLeft <= 12 && !isMemberMatured(m.birth_date, maturedAge)) {
        upcomingMatured.push({
          name: m.full_name,
          unit: getUnitById(m.unit_id)?.name ?? '',
          monthsLeft,
        });
      }

      if (m.joined_date) {
        const j = new Date(m.joined_date);
        const key = `${j.getMonth() + 1}/${j.getFullYear()}`;
        const slot = monthlyJoin.find(x => x.month === key);
        if (slot) slot.count += 1;
      }
    }
    upcomingMatured.sort((a, b) => a.monthsLeft - b.monthsLeft);

    // Chi đoàn thiếu bí thư / chênh quân số / đảng viên / theo loại
    const unitsWithIssues = units
      .filter(u => u.is_active)
      .map(u => {
        const actual = members.filter(m => m.unit_id === u.id && m.is_active);
        const hasSecretary = actual.some(m => m.current_position === 'secretary');
        return {
          unit: u,
          actual: actual.length,
          declared: u.union_member_count,
          mismatch: Math.abs(actual.length - u.union_member_count),
          hasSecretary,
          partyCount: actual.filter(m => m.is_party_member).length,
        };
      });

    return {
      total: active.length,
      groups,
      upcomingMatured,
      monthlyJoin,
      unitsWithIssues,
      vacantSecretary: unitsWithIssues.filter(x => !x.hasSecretary),
      mismatchUnits: unitsWithIssues.filter(x => x.mismatch > 0).sort((a, b) => b.mismatch - a.mismatch).slice(0, 10),
    };
  }, [members, units, yearlySettings.matured_age]);

  // Unit Scores & Rankings Calculation
  const unitScoreList = useMemo(() => {
    const raw = calculateUnitScores();
    return raw.map(item => {
      // Số nhiệm vụ đã duyệt của chi đoàn (tất cả, không lọc tiêu chí)
      const approvedAll = taskResults.filter(
        r => r.unit_id === item.unit.id && r.status === 'approved'
      ).length;
      // Tổng nhiệm vụ được giao (tất cả)
      const assignedAll = taskUnits.filter(tu => tu.unit_id === item.unit.id).length;

      // Chế độ "Có gắn tiêu chí": dùng số liệu repository đã lọc sẵn
      // Chế độ "Tất cả": đếm mọi nhiệm vụ
      const taskCount = taskScope === 'all' ? approvedAll : item.taskCount;
      const taskAssignedCount = taskScope === 'all' ? assignedAll : item.taskAssignedCount;
      const completionRate = taskAssignedCount > 0
        ? Math.min(100, Math.round((taskCount / taskAssignedCount) * 100))
        : 0;

      return {
        unit: item.unit,
        maxPossible: item.maxPossible,
        taskCount,
        taskAssignedCount,
        completionRate,
      };
    }).sort((a, b) => b.taskCount - a.taskCount);
  }, [calculateUnitScores, taskScope, taskResults, taskUnits]);

  /** Tổng hợp theo nhiệm vụ: giao bao nhiêu chi đoàn, đã nộp, đã duyệt, tổng lượt ĐV. */
  const taskSummary = useMemo(() => {
    const withCriteria = new Set(taskSubCriteria.map(t => t.task_id));
    return tasks
      .map(t => {
        const assigned = taskUnits.filter(tu => tu.task_id === t.id).length;
        const rs = taskResults.filter(r => r.task_id === t.id);
        const submitted = rs.length;
        const approved = rs.filter(r => r.status === 'approved').length;
        const participants = rs.reduce((sum, r) => sum + (r.participant_count || 0), 0);
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          hasCriteria: withCriteria.has(t.id),
          assigned,
          submitted,
          approved,
          participants,
        };
      })
      .sort((a, b) => b.submitted - a.submitted);
  }, [tasks, taskUnits, taskResults, taskSubCriteria]);

  // Distribution Data for Charts
  const distributionData = useMemo(() => {
    const counts = { high: 0, mid: 0, low: 0, none: 0 };
    unitScoreList.forEach(u => {
      if (u.taskAssignedCount === 0) counts.none += 1;
      else if (u.completionRate >= 80) counts.high += 1;
      else if (u.completionRate >= 50) counts.mid += 1;
      else counts.low += 1;
    });

    return [
      { name: 'Hoàn thành cao (≥80%)', value: counts.high, color: RANK_COLORS.excellent },
      { name: 'Đạt (50–79%)', value: counts.mid, color: RANK_COLORS.good },
      { name: 'Thấp (<50%)', value: counts.low, color: RANK_COLORS.fair },
      { name: 'Chưa giao nhiệm vụ', value: counts.none, color: RANK_COLORS.average },
    ];
  }, [unitScoreList]);

  // Bar chart top 10 units
  const topUnitsChartData = useMemo(() => {
    return unitScoreList.slice(0, 10).map(u => ({
      name: u.unit.name.replace('Chi đoàn ', ''),
      score: u.taskCount,
      assigned: u.taskAssignedCount,
    }));
  }, [unitScoreList]);

  // Handle Export File
  const handleExportFile = async (format: 'PDF' | 'Word' | 'Excel', name: string) => {
    if (format === 'Word') {
      showToast({
        title: 'Chưa hỗ trợ định dạng Word',
        description: 'Hiện hỗ trợ Excel và PDF. Định dạng .docx sẽ được bổ sung sau.',
        type: 'info',
      });
      return;
    }

    // PDF: dựng trang in rồi mở hộp thoại in của trình duyệt
    if (format === 'PDF') {
      const opened = exportPdf({
        title: 'Bảng tổng hợp nhiệm vụ chi đoàn',
        subtitle: `Năm ${yearlySettings.year}`,
        organization: 'Đoàn TNCS Hồ Chí Minh xã Hòa Bình',
        columns: [
          { header: 'Hạng', key: 'rank', width: '8%', align: 'center' },
          { header: 'Chi đoàn', key: 'unit' },
          { header: 'Đoàn viên', key: 'members', width: '10%', align: 'center' },
          { header: 'Số nhiệm vụ', key: 'task', width: '14%', align: 'center' },
          { header: 'Tỷ lệ', key: 'rate', width: '12%', align: 'center' },
        ],
        rows: unitScoreList.map((item, idx) => ({
          rank: idx + 1,
          unit: item.unit.name,
          members: item.unit.union_member_count,
          task: `${item.taskCount}/${item.taskAssignedCount}`,
          rate: `${item.completionRate}%`,
        })),
        footerNote: 'Xếp hạng theo số nhiệm vụ đã được duyệt. Cột tỷ lệ để đối chiếu mức hoàn thành.',
      });
      if (!opened) {
        showToast({ title: 'Trình duyệt chặn cửa sổ in', description: 'Hãy cho phép popup cho trang này rồi thử lại.', type: 'error' });
      } else {
        showToast({ title: 'Đã mở bản in PDF', description: 'Chọn "Lưu thành PDF" trong hộp thoại in.', type: 'success' });
      }
      return;
    }
    // Xuất bảng xếp loại thi đua thật
    const rows = unitScoreList.map((item, idx) => ({
      rank: idx + 1,
      unit: item.unit.name,
      members: item.unit.union_member_count,
      task: `${item.taskCount}/${item.taskAssignedCount}`,
      rate: `${item.completionRate}%`,
    }));
    await exportExcel({
      fileName: name.endsWith('.xlsx') ? name : `${name}.xlsx`,
      sheetName: 'Tổng hợp',
      title: `BẢNG TỔNG HỢP NHIỆM VỤ CHI ĐOÀN NĂM ${yearlySettings.year}`,
      columns: [
        { header: 'Hạng', key: 'rank', width: 8 },
        { header: 'Chi đoàn', key: 'unit', width: 26 },
        { header: 'Đoàn viên', key: 'members', width: 10 },
        { header: 'Số nhiệm vụ', key: 'task', width: 14 },
        { header: 'Tỷ lệ hoàn thành', key: 'rate', width: 16 },
      ],
      rows,
    });
    showToast({
      title: 'Đã xuất file Excel',
      description: `${rows.length} chi đoàn.`,
      type: 'success',
    });
  };

  // Handle Create Report Submit
  const handlePublishReport = () => {
    // Chỉ tính trong kỳ báo cáo (period_start → period_end) để số liệu đúng kỳ
    const from = periodStart ? new Date(periodStart).getTime() : 0;
    const to = periodEnd ? new Date(periodEnd).getTime() + 86400000 : Number.MAX_SAFE_INTEGER;
    const inPeriod = (iso: string | undefined | null): boolean => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    };

    const tasksInPeriod = tasks.filter(t => inPeriod(t.assigned_at) || inPeriod(t.due_date));
    const resultsInPeriod = taskResults.filter(r => inPeriod(r.completed_at));
    const submissionsInPeriod = memberSubmissions.filter(x => inPeriod(x.submitted_at));
    const membersJoinedInPeriod = members.filter(m => m.is_active && inPeriod(m.joined_date));

    // Chỉ số trong kỳ
    const submitted = resultsInPeriod.length;
    const approved = resultsInPeriod.filter(r => r.status === 'approved').length;
    const pending = resultsInPeriod.filter(r => r.status === 'pending').length;
    const rejected = resultsInPeriod.filter(r => r.status === 'rejected').length;

    const byUnit = units
      .map(u => {
        const rs = resultsInPeriod.filter(r => r.unit_id === u.id);
        return {
          unit_name: u.name,
          assigned: taskUnits.filter(tu => tu.unit_id === u.id && tasksInPeriod.some(t => t.id === tu.task_id)).length,
          submitted: rs.length,
          approved: rs.filter(r => r.status === 'approved').length,
          participants: rs.reduce((sum, r) => sum + (r.participant_count || 0), 0),
        };
      })
      .sort((a, b) => b.approved - a.approved);

    const snapshotData = {
      sections: {
        includeTaskProgress,
        includeCriteriaScores,
        includeMemberDynamics,
        includeUnitRankings,
      },
      period: {
        start: periodStart,
        end: periodEnd,
        scope_unit_id: reportScope === 'all' ? null : reportScope,
      },
      summary: {
        totalUnits: units.length,
        totalMembers: members.length,
        publishedTasks: tasks.filter(t => t.status === 'published').length,
        totalApprovedTasks: unitScoreList.reduce((acc, curr) => acc + curr.taskCount, 0),
        // Số liệu TRONG KỲ
        taskInPeriod: tasksInPeriod.length,
        resultSubmitted: submitted,
        resultApproved: approved,
        resultPending: pending,
        resultRejected: rejected,
        memberSubmissionCount: submissionsInPeriod.length,
        memberSubmissionApproved: submissionsInPeriod.filter(x => x.status === 'approved').length,
        newMembersInPeriod: membersJoinedInPeriod.length,
        totalParticipants: resultsInPeriod.reduce((sum, r) => sum + (r.participant_count || 0), 0),
        completionRate: submitted > 0 ? Math.round((approved / submitted) * 100) : 0,
        byUnit,
      },
      personnel: {
        byAgeGroup: personnelStats.groups,
        upcomingMatured: personnelStats.upcomingMatured.length,
        vacantSecretaryUnits: personnelStats.vacantSecretary.map(x => x.unit.name),
      },
      participation: {
        joined: participationStats.totalJoined,
        submitted: participationStats.totalSubmitted,
        neverJoined: participationStats.neverJoined.length,
      },
    };

    createReportSnapshot(
      reportType,
      periodStart,
      periodEnd,
      reportScope === 'all' ? null : reportScope,
      snapshotData
    );

    setIsCreateModalOpen(false);
    setStep(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#1F5FBF]" />
            Báo cáo & Tổng hợp Thi đua
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Hệ thống trích xuất báo cáo định kỳ, xếp loại thi đua Chi đoàn và trực quan hóa phân bố điểm số
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" /> Tải lại dữ liệu
          </button>
          <button
            type="button"
            onClick={() => handleExportFile('PDF', 'Tong_hop_Cong_tac_Doan_2026.pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" /> Xuất PDF/Word
          </button>
          <button
            type="button"
            onClick={() => {
              setStep(1);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Tạo báo cáo mới
          </button>
        </div>
      </div>

      {/* TABS CHUYỂN ĐỔI: DANH SÁCH BÁO CÁO VS BẢNG XẾP LOẠI & BIỂU ĐỒ */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('reports_list')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'reports_list'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Danh sách Báo cáo đã lập ({reports.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personnel')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'personnel'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Thống kê Nhân sự</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('participation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'participation'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Mức độ Tham gia</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ranking_dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'ranking_dashboard'
              ? 'border-[#1F5FBF] text-[#1F5FBF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Bảng Xếp loại Chi đoàn & Biểu đồ Phân bố</span>
        </button>
      </div>

      {/* TAB 1: DANH SÁCH BÁO CÁO ĐÃ LẬP */}
      {activeTab === 'reports_list' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Loại báo cáo</th>
                    <th className="p-3.5">Tên báo cáo</th>
                    <th className="p-3.5">Kỳ báo cáo</th>
                    <th className="p-3.5">Ngày tạo</th>
                    <th className="p-3.5">Người tạo</th>
                    <th className="p-3.5 text-center">Trạng thái</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map(rep => {
                    const isYearly = rep.report_type === 'yearly' || rep.type === 'yearly' || rep.report_type === 'annual';
                    const isQuarterly = rep.report_type === 'quarterly' || rep.type === 'quarterly' || rep.report_type === 'task_summary';
                    const isMonthly = rep.report_type === 'monthly' || rep.type === 'monthly' || rep.report_type === 'member_stats';

                    const typeBadge = isYearly
                      ? { label: 'Tổng kết năm', color: 'bg-purple-100 text-purple-800 border-purple-200' }
                      : isQuarterly
                      ? { label: 'Định kỳ Quý', color: 'bg-blue-100 text-[#1F5FBF] border-blue-200' }
                      : isMonthly
                      ? { label: 'Định kỳ Tháng', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
                      : { label: 'Chuyên đề', color: 'bg-amber-100 text-amber-800 border-amber-200' };

                    const titleText = rep.title || 'Báo cáo Công tác Đoàn';

                    return (
                      <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                        </td>

                        <td className="p-3.5 font-bold text-slate-900 max-w-sm">
                          <div className="line-clamp-1" title={titleText}>
                            {titleText}
                          </div>
                        </td>

                        <td className="p-3.5 text-slate-600 whitespace-nowrap">
                          {formatDateVN(rep.period_start)} → {formatDateVN(rep.period_end)}
                        </td>

                        <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {formatDateTimeVN(rep.created_at)}
                        </td>

                        <td className="p-3.5 font-medium text-slate-800 whitespace-nowrap">
                          Bí thư Đoàn xã
                        </td>

                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <Check className="w-3 h-3" /> Đã xuất bản
                          </span>
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                          <button
                            type="button"
                            onClick={() => setSelectedReport(rep)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#1F5FBF] hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            Xem chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportFile('PDF', titleText)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            Tải PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB MỨC ĐỘ THAM GIA */}
      {activeTab === 'participation' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Lượt bấm tham gia', value: participationStats.totalJoined, cls: 'text-emerald-700' },
              { label: 'Lượt nộp bài thực tế', value: participationStats.totalSubmitted, cls: 'text-[#1F5FBF]' },
              { label: 'Tham gia nhưng không nộp', value: participationStats.joinButNoSubmit, cls: 'text-amber-700' },
              { label: 'Đoàn viên chưa từng tham gia', value: participationStats.neverJoined.length, cls: 'text-rose-600' },
            ].map(x => (
              <div key={x.label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
                <p className={`text-2xl font-extrabold ${x.cls}`}>{x.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{x.label}</p>
              </div>
            ))}
          </div>

          {participationStats.totalJoined > participationStats.totalSubmitted && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <b>Khoảng cách ý định – hành động:</b>{' '}
              {participationStats.joinButNoSubmit} lượt đoàn viên bấm "Tham gia" nhưng chưa nộp minh chứng.
              Đây là nhóm cần đôn đốc.
            </div>
          )}

          {/* Tỷ lệ tham gia theo chi đoàn */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#1F5FBF]" />
                  Tỷ lệ đoàn viên có tham gia theo chi đoàn
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đoàn viên có ít nhất một bài nộp / tổng đoàn viên đang hoạt động.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await exportExcel({
                    fileName: `Muc_do_tham_gia_theo_chi_doan_${yearlySettings.year}.xlsx`,
                    sheetName: 'Tham gia',
                    title: 'MỨC ĐỘ THAM GIA CỦA ĐOÀN VIÊN THEO CHI ĐOÀN',
                    columns: [
                      { header: 'Chi đoàn', key: 'unit', width: 26 },
                      { header: 'Đoàn viên', key: 'total', width: 11 },
                      { header: 'Có tham gia', key: 'active', width: 13 },
                      { header: 'Tỷ lệ', key: 'rate', width: 10 },
                      { header: 'Lượt bấm tham gia', key: 'joined', width: 18 },
                      { header: 'Lượt nộp bài', key: 'submitted', width: 14 },
                      { header: 'Lượt được duyệt', key: 'approved', width: 16 },
                    ],
                    rows: participationStats.perUnit.map(x => ({
                      unit: x.unit.name,
                      total: x.members_count,
                      active: x.activeMembers,
                      rate: `${x.rate}%`,
                      joined: x.joined,
                      submitted: x.submitted,
                      approved: x.approved,
                    })),
                  });
                  showToast({ title: 'Đã xuất file Excel', description: `${participationStats.perUnit.length} chi đoàn.`, type: 'success' });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" /> Xuất Excel
              </button>
            </div>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-3">Chi đoàn</th>
                    <th className="p-3 text-center">Đoàn viên</th>
                    <th className="p-3 text-center">Có tham gia</th>
                    <th className="p-3 text-center">Tỷ lệ</th>
                    <th className="p-3 text-center">Bấm tham gia</th>
                    <th className="p-3 text-center">Nộp bài</th>
                    <th className="p-3 text-center">Được duyệt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participationStats.perUnit.map(x => (
                    <tr key={x.unit.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{x.unit.name}</td>
                      <td className="p-3 text-center text-slate-600">{x.members_count}</td>
                      <td className="p-3 text-center font-bold text-slate-800">{x.activeMembers}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                x.rate >= 70 ? 'bg-emerald-500' : x.rate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${x.rate}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 w-9 text-right">{x.rate}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-center text-emerald-700 font-semibold">{x.joined}</td>
                      <td className="p-3 text-center text-[#1F5FBF] font-semibold">{x.submitted}</td>
                      <td className="p-3 text-center text-slate-700">{x.approved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top đoàn viên tích cực */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  Đoàn viên tích cực nhất
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Xếp theo số bài nộp được duyệt</p>
              </div>
              {participationStats.topActive.length === 0 ? (
                <p className="p-6 text-center text-slate-400 text-xs">Chưa có dữ liệu.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {participationStats.topActive.map((x, i) => (
                    <div key={x.member.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          i < 3 ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-600'
                        }`}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{x.member.full_name}</p>
                          <p className="text-[10px] text-slate-500">{getUnitById(x.member.unit_id)?.name ?? ''}</p>
                        </div>
                      </div>
                      <div className="text-[11px] text-right shrink-0">
                        <span className="font-bold text-emerald-700">{x.approved}</span>
                        <span className="text-slate-400"> duyệt / </span>
                        <span className="font-semibold text-[#1F5FBF]">{x.submitted}</span>
                        <span className="text-slate-400"> nộp</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Đoàn viên chưa từng tham gia */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Chưa từng tham gia ({participationStats.neverJoined.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Không bấm tham gia và không nộp bài nào</p>
                </div>
                <button
                  type="button"
                  disabled={participationStats.neverJoined.length === 0}
                  onClick={async () => {
                    await exportExcel({
                      fileName: `Doan_vien_chua_tham_gia_${yearlySettings.year}.xlsx`,
                      sheetName: 'Chưa tham gia',
                      title: 'DANH SÁCH ĐOÀN VIÊN CHƯA THAM GIA HOẠT ĐỘNG',
                      columns: [
                        { header: 'Họ và tên', key: 'name', width: 26 },
                        { header: 'Chi đoàn', key: 'unit', width: 26 },
                      ],
                      rows: participationStats.neverJoined.map(x => ({
                        name: x.member.full_name,
                        unit: getUnitById(x.member.unit_id)?.name ?? '',
                      })),
                    });
                    showToast({ title: 'Đã xuất file Excel', description: `${participationStats.neverJoined.length} đoàn viên.`, type: 'success' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" /> Xuất Excel
                </button>
              </div>
              {participationStats.neverJoined.length === 0 ? (
                <p className="p-6 text-center text-emerald-600 text-xs font-semibold">Mọi đoàn viên đều đã tham gia ít nhất một hoạt động.</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {participationStats.neverJoined.map(x => (
                    <div key={x.member.id} className="p-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 truncate">{x.member.full_name}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">
                        {getUnitById(x.member.unit_id)?.name ?? ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB NHÂN SỰ */}
      {activeTab === 'personnel' && (
        <div className="space-y-5">
          {/* Tổng quan */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Tổng đoàn viên', value: personnelStats.total, cls: 'text-[#1F5FBF]' },
              { label: 'Chi đoàn hoạt động', value: units.filter(u => u.is_active).length, cls: 'text-slate-800' },
              { label: 'Sắp trưởng thành (12 tháng)', value: personnelStats.upcomingMatured.length, cls: 'text-amber-700' },
              { label: 'Chi đoàn thiếu bí thư', value: personnelStats.vacantSecretary.length, cls: personnelStats.vacantSecretary.length > 0 ? 'text-rose-600' : 'text-emerald-700' },
            ].map(x => (
              <div key={x.label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center">
                <p className={`text-2xl font-extrabold ${x.cls}`}>{x.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{x.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Phân bố độ tuổi */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
                Phân bố theo độ tuổi
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Dưới 18', value: personnelStats.groups.under18 },
                      { name: '18 – 25', value: personnelStats.groups.from18to25 },
                      { name: '26 – 30', value: personnelStats.groups.from26to30 },
                      { name: 'Trên 30', value: personnelStats.groups.over30 },
                    ]}
                    margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [`${v} đoàn viên`, 'Số lượng']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" fill="#1F5FBF" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Kết nạp theo tháng */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 pb-2 border-b border-slate-100">
                Đoàn viên kết nạp 12 tháng gần nhất
              </h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={personnelStats.monthlyJoin} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [`${v} đoàn viên`, 'Kết nạp']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sắp trưởng thành — cần chuẩn bị chuyển sinh hoạt */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Đoàn viên sắp trưởng thành ({personnelStats.upcomingMatured.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đủ {yearlySettings.matured_age} tuổi trong 12 tháng tới — cần chuẩn bị chuyển sinh hoạt.
                </p>
              </div>
              <button
                type="button"
                disabled={personnelStats.upcomingMatured.length === 0}
                onClick={async () => {
                  await exportExcel({
                    fileName: `Doan_vien_sap_truong_thanh_${yearlySettings.year}.xlsx`,
                    sheetName: 'Sắp trưởng thành',
                    title: 'DANH SÁCH ĐOÀN VIÊN SẮP TRƯỞNG THÀNH',
                    columns: [
                      { header: 'Họ và tên', key: 'name', width: 26 },
                      { header: 'Chi đoàn', key: 'unit', width: 26 },
                      { header: 'Còn lại (tháng)', key: 'months', width: 16 },
                    ],
                    rows: personnelStats.upcomingMatured.map(x => ({
                      name: x.name, unit: x.unit, months: x.monthsLeft,
                    })),
                  });
                  showToast({ title: 'Đã xuất file Excel', description: `${personnelStats.upcomingMatured.length} đoàn viên.`, type: 'success' });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> Xuất Excel
              </button>
            </div>
            {personnelStats.upcomingMatured.length === 0 ? (
              <p className="p-6 text-center text-slate-400 text-xs">Không có đoàn viên nào sắp trưởng thành trong 12 tháng tới.</p>
            ) : (
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-3">Họ và tên</th>
                      <th className="p-3">Chi đoàn</th>
                      <th className="p-3 text-center">Còn lại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {personnelStats.upcomingMatured.map((m, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-slate-900">{m.name}</td>
                        <td className="p-3 text-slate-600">{m.unit}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            m.monthsLeft <= 3 ? 'bg-rose-100 text-rose-800'
                            : m.monthsLeft <= 6 ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                          }`}>
                            {m.monthsLeft} tháng
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chi đoàn thiếu bí thư */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Chi đoàn thiếu bí thư ({personnelStats.vacantSecretary.length})
                </h3>
              </div>
              {personnelStats.vacantSecretary.length === 0 ? (
                <p className="p-6 text-center text-emerald-600 text-xs font-semibold">Mọi chi đoàn đều có bí thư.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {personnelStats.vacantSecretary.map(x => (
                    <div key={x.unit.id} className="p-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">{x.unit.name}</span>
                      <span className="text-[11px] text-slate-500">{x.actual} đoàn viên</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chênh lệch quân số */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  Chênh lệch quân số khai báo / thực tế
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Top 10 chi đoàn lệch nhiều nhất</p>
              </div>
              {personnelStats.mismatchUnits.length === 0 ? (
                <p className="p-6 text-center text-emerald-600 text-xs font-semibold">Quân số khai báo khớp thực tế.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {personnelStats.mismatchUnits.map(x => (
                    <div key={x.unit.id} className="p-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800 truncate">{x.unit.name}</span>
                      <span className="text-[11px] whitespace-nowrap">
                        <span className="text-slate-500">khai {x.declared}</span>
                        {' / '}
                        <span className="font-bold text-[#1F5FBF]">{x.actual}</span>
                        <span className={`ml-2 px-1.5 py-0.5 rounded font-bold ${
                          x.mismatch > 5 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>lệch {x.mismatch}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BẢNG TỔNG HỢP XẾP LOẠI CHI ĐOÀN & BIỂU ĐỒ PHÂN BỐ */}
      {activeTab === 'ranking_dashboard' && (
        <div className="space-y-6">
          {/* HÀNG BIỂU ĐỒ: BIỂU ĐỒ TRÒN PHÂN BỐ & BIỂU ĐỒ CỘT TOP CHI ĐOÀN */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Biểu đồ tròn phân bố tỷ lệ xếp loại */}
            <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-[#1F5FBF]" />
                  Phân bố Xếp loại Thi đua ({units.length} Chi đoàn)
                </h3>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={entry => `${(((entry as any).percent || 0) * 100).toFixed(0)}%`}
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val ?? 0} Chi đoàn`, 'Số lượng']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between p-2 rounded bg-emerald-50 text-emerald-900">
                  <span className="font-semibold">Xuất sắc:</span>
                  <strong>{distributionData[0].value} chi đoàn</strong>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-blue-50 text-blue-900">
                  <span className="font-semibold">Tốt:</span>
                  <strong>{distributionData[1].value} chi đoàn</strong>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-amber-50 text-amber-900">
                  <span className="font-semibold">Khá:</span>
                  <strong>{distributionData[2].value} chi đoàn</strong>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-red-50 text-red-900">
                  <span className="font-semibold">Trung bình:</span>
                  <strong>{distributionData[3].value} chi đoàn</strong>
                </div>
              </div>
            </div>

            {/* Biểu đồ cột: Top 10 Chi đoàn dẫn đầu */}
            <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1F5FBF]" />
                  Top 10 Chi đoàn Dẫn đầu Điểm số Tích lũy
                </h3>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topUnitsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-25}
                      textAnchor="end"
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val ?? 0} điểm`, 'Tổng điểm']}
                    />
                    <Bar dataKey="score" fill="#1F5FBF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-slate-400 text-center">
                Điểm số được tổng hợp tự động từ kết quả chấm Bộ tiêu chí và điểm đóng góp từ các nhiệm vụ đã hoàn thành.
              </p>
            </div>
          </div>

          {/* BẢNG TỔNG HỢP CHI TIẾT 31 CHI ĐOÀN */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-900">
                  Bảng Tổng hợp Xếp loại Thi đua Chi đoàn Năm {yearlySettings.year}
                </h3>
                <p className="text-xs text-slate-500">
                  Quy chuẩn Đoàn: Xuất sắc (≥85đ), Tốt (70–84đ), Khá (50–69đ), Trung bình (&lt;50đ)
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleExportFile('Excel', `Bang_xep_loai_thi_dua_${yearlySettings.year}.xlsx`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Xuất Excel
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500">Đếm nhiệm vụ:</span>
              <button type="button" onClick={() => setTaskScope('with_criteria')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${taskScope === 'with_criteria' ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Chỉ đếm nhiệm vụ đã gắn tiêu chí (mặc định)">
                Có gắn tiêu chí
              </button>
              <button type="button" onClick={() => setTaskScope('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg ${taskScope === 'all' ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                title="Đếm mọi nhiệm vụ đã duyệt">
                Tất cả
              </button>
              <span className="text-[11px] text-slate-400 ml-2">Bấm tiêu đề cột để đổi cách xếp hạng.</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center w-12">Hạng</th>
                    <th className="p-3">Chi đoàn cơ sở</th>
                    <th className="p-3 text-center">Đoàn viên</th>
                    <th className="p-3 text-center">
                      Số nhiệm vụ <span className="text-[#1F5FBF]">↓</span>
                    </th>
                    <th className="p-3 text-center">Tỷ lệ hoàn thành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {unitScoreList.map((item, idx) => (
                    <tr key={item.unit.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-700">
                        {idx + 1 <= 3 ? (
                          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-900 font-extrabold inline-flex items-center justify-center text-xs shadow-2xs">
                            {idx + 1}
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {item.unit.name}
                      </td>

                      <td className="p-3 text-center font-medium text-slate-700">
                        {item.unit.union_member_count}
                      </td>

                      <td className="p-3 text-center font-bold text-slate-800">
                        {item.taskCount}
                        <span className="text-xs text-slate-400 font-normal">/{item.taskAssignedCount}</span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <div className="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.taskAssignedCount === 0
                                  ? 'bg-slate-300'
                                  : item.completionRate >= 80
                                  ? 'bg-emerald-500'
                                  : item.completionRate >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${item.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-10 text-right">
                            {item.completionRate}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TỔNG HỢP THEO NHIỆM VỤ */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#1F5FBF]" />
              Tổng hợp theo nhiệm vụ
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mỗi nhiệm vụ: số chi đoàn được giao, đã nộp, đã duyệt và tổng lượt đoàn viên tham gia.
            </p>
          </div>
        </div>

        {taskSummary.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-xs">Chưa có nhiệm vụ nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Nhiệm vụ</th>
                  <th className="p-3 text-center">Tiêu chí</th>
                  <th className="p-3 text-center">Được giao</th>
                  <th className="p-3 text-center">Đã nộp</th>
                  <th className="p-3 text-center">Đã duyệt</th>
                  <th className="p-3 text-center">Lượt ĐV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taskSummary.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-900 max-w-xs truncate" title={t.title}>{t.title}</td>
                    <td className="p-3 text-center">
                      {t.hasCriteria
                        ? <span className="text-emerald-700 font-bold">Có</span>
                        : <span className="text-slate-400">Không</span>}
                    </td>
                    <td className="p-3 text-center text-slate-700">{t.assigned}</td>
                    <td className="p-3 text-center font-bold text-[#1F5FBF]">{t.submitted}</td>
                    <td className="p-3 text-center font-bold text-emerald-700">{t.approved}</td>
                    <td className="p-3 text-center text-slate-700">{t.participants}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 3 BƯỚC: TẠO BÁO CÁO MỚI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-5 shadow-2xl text-xs">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#1F5FBF]" />
                  Thiết lập Báo cáo Tổng hợp – Bước {step}/3
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  {step === 1 && 'Bước 1: Chọn kỳ báo cáo & Loại hình văn bản'}
                  {step === 2 && 'Bước 2: Chọn các module dữ liệu đưa vào báo cáo'}
                  {step === 3 && 'Bước 3: Xem trước dữ liệu và Xuất bản chính thức'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Header Pills */}
            <div className="flex items-center gap-2">
              <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-[#1F5FBF]' : 'bg-slate-200'}`} />
              <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-[#1F5FBF]' : 'bg-slate-200'}`} />
              <div className={`flex-1 h-1.5 rounded-full ${step >= 3 ? 'bg-[#1F5FBF]' : 'bg-slate-200'}`} />
            </div>

            {/* BƯỚC 1: CHỌN KỲ & LOẠI */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Loại báo cáo (*):</label>
                  <select
                    value={reportType}
                    onChange={e => {
                      const t = e.target.value as ReportType;
                      setReportType(t);
                      if (t === 'monthly') setReportTitle('Báo cáo Công tác Đoàn Tháng 10/2026');
                      if (t === 'quarterly') setReportTitle('Báo cáo Công tác Đoàn Quý III/2026');
                      if (t === 'yearly') setReportTitle('Báo cáo Tổng kết Công tác Đoàn & Phong trào TTN Năm 2026');
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                  >
                    <option value="monthly">Báo cáo định kỳ Tháng</option>
                    <option value="quarterly">Báo cáo định kỳ Quý</option>
                    <option value="yearly">Báo cáo Tổng kết Niên độ (Năm)</option>
                    <option value="special">Báo cáo Chuyên đề / Đột xuất</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Tiêu đề văn bản (*):</label>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={e => setReportTitle(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-[#1F5FBF] focus:outline-none focus:border-[#1F5FBF]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Từ ngày:</label>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={e => setPeriodStart(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">Đến ngày:</label>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={e => setPeriodEnd(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Phạm vi cơ sở:</label>
                  <select
                    value={reportScope}
                    onChange={e => setReportScope(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900"
                  >
                    <option value="all">Toàn xã (31 Chi đoàn trực thuộc)</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>
                        Chỉ riêng: {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* BƯỚC 2: CHỌN MỤC ĐƯA VÀO */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-slate-600">
                  Tích chọn các phụ lục số liệu cần tổng hợp tự động vào văn bản báo cáo:
                </p>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTaskProgress}
                      onChange={e => setIncludeTaskProgress(e.target.checked)}
                      className="w-4 h-4 text-[#1F5FBF] mt-0.5 rounded"
                    />
                    <div>
                      <strong className="text-slate-900 block">1. Tiến độ thực hiện nhiệm vụ & phong trào</strong>
                      <span className="text-slate-500 text-[11px]">
                        Tổng hợp 5 chiến dịch, tỷ lệ nộp minh chứng và kết quả giải ngân/thực hiện của các chi đoàn.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeCriteriaScores}
                      onChange={e => setIncludeCriteriaScores(e.target.checked)}
                      className="w-4 h-4 text-[#1F5FBF] mt-0.5 rounded"
                    />
                    <div>
                      <strong className="text-slate-900 block">2. Điểm số đánh giá Bộ tiêu chí thi đua</strong>
                      <span className="text-slate-500 text-[11px]">
                        Điểm tự chấm và điểm BCH Đoàn xã thẩm định của từng tiêu chí theo quy chế thi đua.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMemberDynamics}
                      onChange={e => setIncludeMemberDynamics(e.target.checked)}
                      className="w-4 h-4 text-[#1F5FBF] mt-0.5 rounded"
                    />
                    <div>
                      <strong className="text-slate-900 block">3. Biến động đoàn số & phát triển đoàn viên</strong>
                      <span className="text-slate-500 text-[11px]">
                        Số kết nạp mới so với chỉ tiêu ({yearlySettings.new_member_target}), số trưởng thành đoàn và chuyển sinh hoạt.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUnitRankings}
                      onChange={e => setIncludeUnitRankings(e.target.checked)}
                      className="w-4 h-4 text-[#1F5FBF] mt-0.5 rounded"
                    />
                    <div>
                      <strong className="text-slate-900 block">4. Bảng xếp loại và đề xuất khen thưởng Chi đoàn</strong>
                      <span className="text-slate-500 text-[11px]">
                        Danh sách phân loại 4 mức (Xuất sắc, Tốt, Khá, Trung bình) kèm biểu đồ tỷ lệ phần trăm.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* BƯỚC 3: XEM TRƯỚC & XUẤT BẢN */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-800 uppercase text-[11px]">Bản xem trước văn bản:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-[#1F5FBF]">
                      Dữ liệu thời gian thực
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 text-center">{reportTitle}</h4>
                  <p className="text-center text-slate-500 text-[11px]">
                    Kỳ báo cáo: Từ {formatDateVN(periodStart)} đến {formatDateVN(periodEnd)}
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Tổng chi đoàn</span>
                      <strong className="text-slate-900 text-sm">{units.length}</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Đoàn viên</span>
                      <strong className="text-[#1F5FBF] text-sm">{members.length}</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Nhiệm vụ đã duyệt</span>
                      <strong className="text-emerald-600 text-sm">{taskResults.filter(r => r.status === 'approved').length}</strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">Nhiệm vụ TB / chi đoàn</span>
                      <strong className="text-purple-600 text-sm">
                        {(unitScoreList.reduce((acc, curr) => acc + curr.taskCount, 0) / (units.length || 1)).toFixed(1)}
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 text-slate-600 text-[11px] space-y-1">
                    <p>✓ Mục 1: Tiến độ chiến dịch – {includeTaskProgress ? 'Đã đưa vào' : 'Bỏ qua'}</p>
                    <p>✓ Mục 2: Tiêu chí thi đua – {includeCriteriaScores ? 'Đã đưa vào' : 'Bỏ qua'}</p>
                    <p>✓ Mục 3: Biến động đoàn số – {includeMemberDynamics ? 'Đã đưa vào' : 'Bỏ qua'}</p>
                    <p>✓ Mục 4: Bảng xếp loại 31 Chi đoàn – {includeUnitRankings ? 'Đã đưa vào' : 'Bỏ qua'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => setStep((step - 1) as any)}
                  className="inline-flex items-center gap-1 px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Quay lại
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Hủy
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((step + 1) as any)}
                  className="inline-flex items-center gap-1 px-5 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer shadow-xs"
                >
                  Tiếp tục <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePublishReport}
                  className="inline-flex items-center gap-1.5 px-6 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" /> Xuất bản & Lưu trữ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHI TIẾT BÁO CÁO */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Chi tiết Văn bản Báo cáo</h3>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Tên báo cáo:</span>
                <h4 className="text-sm font-bold text-slate-900 mt-0.5">{selectedReport.title}</h4>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px]">Kỳ báo cáo:</span>
                  <strong>{formatDateVN(selectedReport.period_start)} → {formatDateVN(selectedReport.period_end)}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Ngày xuất bản:</span>
                  <strong>{formatDateTimeVN(selectedReport.created_at)}</strong>
                </div>
              </div>

              {(() => {
                const d = (selectedReport.data ?? {}) as Record<string, any>;
                const sum = (d.summary ?? {}) as Record<string, any>;
                const byUnit = (sum.byUnit ?? []) as Array<Record<string, any>>;
                const hasPeriodData = sum.resultSubmitted !== undefined;
                if (!hasPeriodData) {
                  return (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
                      Báo cáo này được lập trước khi có số liệu theo kỳ. Nội dung chi tiết sẽ có ở các báo cáo lập từ nay.
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Nhiệm vụ trong kỳ', value: sum.taskInPeriod ?? 0 },
                        { label: 'Bài chi đoàn đã nộp', value: sum.resultSubmitted ?? 0 },
                        { label: 'Đã duyệt', value: sum.resultApproved ?? 0, cls: 'text-emerald-700' },
                        { label: 'Chờ duyệt / Từ chối', value: `${sum.resultPending ?? 0} / ${sum.resultRejected ?? 0}` },
                        { label: 'Bài nộp cá nhân', value: sum.memberSubmissionCount ?? 0 },
                        { label: 'Lượt đoàn viên tham gia', value: sum.totalParticipants ?? 0 },
                        { label: 'Đoàn viên mới kết nạp', value: sum.newMembersInPeriod ?? 0 },
                        { label: 'Tỷ lệ duyệt', value: `${sum.completionRate ?? 0}%`, cls: 'text-[#1F5FBF]' },
                      ].map(x => (
                        <div key={x.label} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px]">{x.label}</span>
                          <strong className={`text-sm ${x.cls ?? 'text-slate-800'}`}>{x.value}</strong>
                        </div>
                      ))}
                    </div>

                    {byUnit.length > 0 && (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <p className="px-3 py-2 bg-slate-50 font-bold text-slate-700 text-[11px] uppercase">
                          Chi tiết theo chi đoàn
                        </p>
                        <div className="max-h-52 overflow-y-auto">
                          <table className="w-full text-[11px]">
                            <thead className="bg-white border-b border-slate-100 text-slate-500">
                              <tr>
                                <th className="p-2 text-left">Chi đoàn</th>
                                <th className="p-2 text-center">Nộp</th>
                                <th className="p-2 text-center">Duyệt</th>
                                <th className="p-2 text-center">Lượt ĐV</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {byUnit.map((u, i) => (
                                <tr key={i}>
                                  <td className="p-2 text-slate-800">{u.unit_name}</td>
                                  <td className="p-2 text-center">{u.submitted}</td>
                                  <td className="p-2 text-center font-bold text-emerald-700">{u.approved}</td>
                                  <td className="p-2 text-center">{u.participants}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => handleExportFile('PDF', selectedReport.title)}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg cursor-pointer"
              >
                <Download className="w-4 h-4" /> Tải về máy (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
