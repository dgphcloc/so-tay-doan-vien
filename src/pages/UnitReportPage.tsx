import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
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
  ChevronDown,
  Plus,
} from "lucide-react";
import { formatDateVN } from "../mock/data";
import { exportExcel } from "../utils/exportExcel";
import { CreateTaskDropdown } from "../components/tasks/CreateTaskDropdown";

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
    criteriaSections,
    criteriaSets,
    members,
    showToast,
  } = useApp();

  const isAdmin = currentRole === "super_admin" || currentRole === "admin";
  const isSecretary = currentRole === "unit_secretary";

  // Chọn chi đoàn: bí thư CĐ bị khóa vào chi đoàn mình, admin chọn được
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    currentMember?.unit_id || units[0]?.id || "",
  );

  const effectiveUnitId = isSecretary
    ? (currentMember?.unit_id ?? "")
    : selectedUnitId;

  type Kpi = {
    subCriterionId: string;
    criterionName: string;
    subName: string;
    maxScore: number;
    totalTasks: number;
    doneTasks: number;
    pendingTasks: number;
  };
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshKpis = async () => {
    if (!effectiveUnitId) {
      setKpis([]);
      setLoading(false);
      return;
    }
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
  }, [
    effectiveUnitId,
    getUnitCriterionProgress,
    subCriteria.length,
    tasks.length,
    taskResults.length,
  ]);

  const unit = getUnitById(effectiveUnitId);

  // Nhiệm vụ của chi đoàn này
  const unitTaskIds = useMemo(
    () =>
      new Set(
        taskUnits
          .filter((tu) => tu.unit_id === effectiveUnitId)
          .map((tu) => tu.task_id),
      ),
    [taskUnits, effectiveUnitId],
  );

  const unitTasks = useMemo(() => {
    return tasks
      .filter((t) => unitTaskIds.has(t.id))
      .map((task) => {
        const results = taskResults.filter(
          (r) => r.task_id === task.id && r.unit_id === effectiveUnitId,
        );
        const approved = results.filter((r) => r.status === "approved");
        const pending = results.filter((r) => r.status === "pending");
        const sourceSub = task.source_sub_criterion_id
          ? subCriteria.find((s) => s.id === task.source_sub_criterion_id)
          : null;
        const sourceCriterion = sourceSub
          ? criteria.find((c) => c.id === sourceSub.criterion_id)
          : null;
        return {
          task,
          results,
          approvedCount: approved.length,
          pendingCount: pending.length,
          sourceSub,
          sourceCriterion,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.task.due_date).getTime() -
          new Date(a.task.due_date).getTime(),
      );
  }, [tasks, taskResults, unitTaskIds, effectiveUnitId, subCriteria, criteria]);

  // Đoàn viên trong chi đoàn + số bài họ đã nộp
  const unitMembers = useMemo(() => {
    return members
      .filter((m) => m.unit_id === effectiveUnitId && m.is_active)
      .map((m) => {
        const subs = memberSubmissions.filter((ms) => ms.member_id === m.id);
        return {
          member: m,
          submitted: subs.length,
          approved: subs.filter((s) => s.status === "approved").length,
          pending: subs.filter((s) => s.status === "pending").length,
        };
      })
      .sort((a, b) => b.approved - a.approved);
  }, [members, memberSubmissions, effectiveUnitId]);

  // ===== CẤU TRÚC CÂY: Bộ -> Mục -> Tiêu chí -> Nội dung đánh giá =====
  type Stats = { max: number; total: number; done: number; pending: number };
  const sumOf = (list: Kpi[]): Stats => ({
    max: list.reduce((s, k) => s + (k.maxScore || 0), 0),
    total: list.reduce((s, k) => s + k.totalTasks, 0),
    done: list.reduce((s, k) => s + k.doneTasks, 0),
    pending: list.reduce((s, k) => s + k.pendingTasks, 0),
  });

  const tree = useMemo(() => {
    const kpiBySub = new Map(kpis.map((k) => [k.subCriterionId, k] as const));
    return criteriaSets
      .filter((set) => !set.archived_at)
      .sort((a, b) => b.year - a.year)
      .map((set) => {
        const sections = criteriaSections
          .filter((sec) => sec.criteria_set_id === set.id)
          .sort((a, b) => a.stt - b.stt)
          .map((sec) => {
            const crits = criteria
              .filter((c) => c.section_id === sec.id)
              .sort((a, b) => a.stt - b.stt)
              .map((c) => {
                const items = subCriteria
                  .filter((sc) => sc.criterion_id === c.id)
                  .map((sc) => kpiBySub.get(sc.id))
                  .filter((k): k is Kpi => !!k)
                  .map((k, i) => ({ k, stt: `${sec.stt}.${c.stt}.${i + 1}` }));
                return { crit: c, stt: `${sec.stt}.${c.stt}`, items };
              })
              .filter((c) => c.items.length > 0);
            return { sec, stt: String(sec.stt), crits };
          })
          .filter((s) => s.crits.length > 0);
        return { set, sections };
      })
      .filter((g) => g.sections.length > 0)
      .map((g, i) => ({ ...g, stt: String.fromCharCode(65 + i) }));
  }, [kpis, subCriteria, criteria, criteriaSections, criteriaSets]);

  // Danh sách lá (nội dung đánh giá) theo đúng thứ tự cây: dùng cho thẻ tổng quan + xuất Excel
  const leaves = useMemo(
    () =>
      tree.flatMap((g) =>
        g.sections.flatMap((s) =>
          s.crits.flatMap((c) =>
            c.items.map((it) => ({ ...it, setName: g.set.name })),
          ),
        ),
      ),
    [tree],
  );

  // Đóng/mở nhánh (mặc định mở hết)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleNode = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const collapseAll = () =>
    setCollapsed(
      new Set(
        tree.flatMap((g) => [
          g.set.id,
          ...g.sections.flatMap((s) => [
            s.sec.id,
            ...s.crits.map((c) => c.crit.id),
          ]),
        ]),
      ),
    );
  const expandAll = () => setCollapsed(new Set());

  type Row = {
    key: string;
    level: 0 | 1 | 2 | 3;
    nodeId?: string;
    stt: string;
    label: string;
    stats: Stats;
    kpi?: Kpi;
    open?: boolean;
  };

  const rows = useMemo(() => {
    const out: Row[] = [];
    tree.forEach((g) => {
      const gOpen = !collapsed.has(g.set.id);
      const gKpis = g.sections.flatMap((s) =>
        s.crits.flatMap((c) => c.items.map((i) => i.k)),
      );
      out.push({
        key: `set-${g.set.id}`,
        level: 0,
        nodeId: g.set.id,
        stt: g.stt,
        label: `${g.set.name} (${gKpis.length} tiêu chí)`,
        stats: sumOf(gKpis),
        open: gOpen,
      });
      if (!gOpen) return;
      g.sections.forEach((s) => {
        const sOpen = !collapsed.has(s.sec.id);
        const sKpis = s.crits.flatMap((c) => c.items.map((i) => i.k));
        out.push({
          key: `sec-${s.sec.id}`,
          level: 1,
          nodeId: s.sec.id,
          stt: s.stt,
          label: s.sec.name,
          stats: sumOf(sKpis),
          open: sOpen,
        });
        if (!sOpen) return;
        s.crits.forEach((c) => {
          const cOpen = !collapsed.has(c.crit.id);
          const cKpis = c.items.map((i) => i.k);
          out.push({
            key: `crit-${c.crit.id}`,
            level: 2,
            nodeId: c.crit.id,
            stt: c.stt,
            label: c.crit.name,
            stats: sumOf(cKpis),
            open: cOpen,
          });
          if (!cOpen) return;
          c.items.forEach((it) => {
            out.push({
              key: `sub-${it.k.subCriterionId}`,
              level: 3,
              stt: it.stt,
              label: it.k.subName,
              stats: sumOf([it.k]),
              kpi: it.k,
            });
          });
        });
      });
    });
    return out;
  }, [tree, collapsed]);

  // Tổng hợp
  const summary = useMemo(() => {
    const list = leaves.map((l) => l.k);
    const totalKpi = list.length;
    const doneKpi = list.filter(
      (k) => k.totalTasks > 0 && k.doneTasks >= k.totalTasks,
    ).length;
    const withTasks = list.filter((k) => k.totalTasks > 0).length;
    const totalTasks = unitTasks.length;
    const approvedTasks = unitTasks.filter((t) => t.approvedCount > 0).length;
    const activeMembers = unitMembers.length;
    const submittedMembers = unitMembers.filter((m) => m.submitted > 0).length;
    return {
      totalKpi,
      doneKpi,
      withTasks,
      totalTasks,
      approvedTasks,
      activeMembers,
      submittedMembers,
    };
  }, [leaves, unitTasks, unitMembers]);

  const handleExport = async () => {
    if (!unit) return;
    await exportExcel({
      fileName: `Bao_cao_chi_doan_${unit.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      sheetName: "Tổng hợp",
      title: `BÁO CÁO TỔNG HỢP CHI ĐOÀN ${unit.name.toUpperCase()}`,
      columns: [
        { header: "STT", key: "stt", width: 9 },
        { header: "Bộ tiêu chí", key: "setName", width: 24 },
        { header: "Tiêu chí", key: "criterion", width: 26 },
        { header: "Nội dung", key: "sub", width: 40 },
        { header: "Điểm tối đa", key: "max", width: 12 },
        { header: "Số nhiệm vụ", key: "total", width: 12 },
        { header: "Đã duyệt", key: "done", width: 11 },
        { header: "Chờ duyệt", key: "pending", width: 11 },
        { header: "Trạng thái", key: "status", width: 18 },
      ],
      rows: leaves.map(({ k, stt, setName }) => ({
        stt,
        setName,
        criterion: k.criterionName,
        sub: k.subName,
        max: k.maxScore,
        total: k.totalTasks,
        done: k.doneTasks,
        pending: k.pendingTasks,
        status:
          k.totalTasks === 0
            ? "Chưa tạo nhiệm vụ"
            : k.doneTasks >= k.totalTasks
              ? "Đã hoàn thành"
              : `${Math.round((k.doneTasks / k.totalTasks) * 100)}%`,
      })),
    });
    showToast({ title: "Đã xuất báo cáo chi đoàn", type: "success" });
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
            <BarChart3 className="w-5 h-5 text-doan" />
            Báo cáo chi đoàn
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tổng hợp tiêu chí được Đoàn xã giao, nhiệm vụ đã triển khai và tiến
            độ nộp minh chứng của đoàn viên.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              title="Chọn chi đoàn cần xem báo cáo"
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleExport}
            title="Xuất báo cáo tổng hợp ra file Excel để nộp Đoàn xã"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-doan" /> Xuất Excel
          </button>
        </div>
      </div>

      {/* Thẻ tổng quan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <Target className="w-3.5 h-3.5 text-doan" /> Tiêu chí được giao
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {summary.totalKpi}
          </p>
          <p className="text-[11px] text-emerald-700 mt-0.5">
            {summary.doneKpi} đã hoàn thành · {summary.withTasks} đã có nhiệm vụ
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <ClipboardList className="w-3.5 h-3.5 text-blue-600" /> Nhiệm vụ
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {summary.totalTasks}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.approvedTasks} đã có bài duyệt
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <Users className="w-3.5 h-3.5 text-emerald-600" /> Đoàn viên
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {summary.activeMembers}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {summary.submittedMembers} đã nộp minh chứng
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Tỷ lệ tiêu
            chí
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {summary.totalKpi > 0
              ? Math.round((summary.doneKpi / summary.totalKpi) * 100)
              : 0}
            %
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            theo số tiêu chí đã hoàn thành
          </p>
        </div>
      </div>

      {/* Bảng tiêu chí được giao (dạng cây) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-doan" />
            Tiêu chí Đoàn xã giao ({leaves.length})
          </h2>
          {tree.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Mở rộng tất cả
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                Thu gọn tất cả
              </button>
            </div>
          )}
        </div>

        {leaves.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chi đoàn chưa được giao tiêu chí nào trong bộ tiêu chí hiện hành.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold w-16">
                    STT
                  </th>
                  <th className="text-left px-3 py-2 font-semibold">
                    Tiêu chí
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">Điểm</th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Nhiệm vụ
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Đã duyệt
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Chờ duyệt
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Tiến độ
                  </th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const { max, total, done: doneN, pending } = r.stats;
                  const pct = total > 0 ? Math.round((doneN / total) * 100) : 0;
                  const done = total > 0 && doneN >= total;
                  const noTask = total === 0;
                  const isLeaf = r.level === 3;
                  const rowCls =
                    r.level === 0
                      ? "bg-blue-50/70 font-bold text-slate-900"
                      : r.level === 1
                        ? "bg-slate-50 font-semibold text-slate-900"
                        : r.level === 2
                          ? "font-semibold text-slate-800"
                          : "hover:bg-slate-50/70 text-slate-800";
                  const indent = [0, 16, 32, 52][r.level];

                  return (
                    <tr key={r.key} className={rowCls}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {r.stt}
                      </td>
                      <td
                        className="px-3 py-2"
                        style={{ paddingLeft: 12 + indent }}
                      >
                        {isLeaf ? (
                          <span>{r.label}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => r.nodeId && toggleNode(r.nodeId)}
                            className="inline-flex items-start gap-1.5 text-left"
                          >
                            {r.open ? (
                              <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-doan" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-doan" />
                            )}
                            <span>{r.label}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-amber-700">
                        {max}
                      </td>
                      <td className="px-2 py-2 text-center font-semibold">
                        {total}
                      </td>
                      <td className="px-2 py-2 text-center font-bold text-emerald-700">
                        {doneN}
                      </td>
                      <td className="px-2 py-2 text-center font-semibold text-amber-700">
                        {pending}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : "bg-doan"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={`text-[10px] font-bold ${noTask ? "text-rose-600" : done ? "text-emerald-700" : "text-slate-600"}`}
                          >
                            {noTask ? "Chưa tạo" : `${pct}%`}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {r.kpi && (
                          <CreateTaskDropdown
                            subCriterionId={r.kpi.subCriterionId}
                            subName={r.kpi.subName}
                            maxScore={r.kpi.maxScore}
                            unitId={effectiveUnitId}
                            onCreated={() => {
                              void refreshKpis();
                            }}
                          />
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
                  <th className="text-left px-3 py-2 font-semibold">
                    Nhiệm vụ
                  </th>
                  <th className="text-left px-2 py-2 font-semibold">
                    Tiêu chí nguồn
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Hạn chót
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Đã duyệt
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Chờ duyệt
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Trạng thái
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitTasks.map(
                  ({ task, approvedCount, pendingCount, sourceSub }) => {
                    const overdue =
                      new Date(task.due_date).getTime() < Date.now() &&
                      approvedCount === 0;
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-semibold text-slate-800 max-w-xs">
                          <span className="line-clamp-2">{task.title}</span>
                        </td>
                        <td className="px-2 py-2 text-slate-600 max-w-[200px]">
                          {sourceSub ? (
                            <span className="line-clamp-2 text-[11px]">
                              {sourceSub.condition_text}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">
                              Không gắn tiêu chí
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center text-slate-600 whitespace-nowrap">
                          {formatDateVN(task.due_date)}
                        </td>
                        <td className="px-2 py-2 text-center font-bold text-emerald-700">
                          {approvedCount}
                        </td>
                        <td className="px-2 py-2 text-center font-semibold text-amber-700">
                          {pendingCount}
                        </td>
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
                  },
                )}
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
          <div className="p-8 text-center text-xs text-slate-500">
            Chi đoàn chưa có đoàn viên đang hoạt động.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">
                    Đoàn viên
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Đã nộp
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Đã duyệt
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Chờ duyệt
                  </th>
                  <th className="text-center px-2 py-2 font-semibold">
                    Đánh giá
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unitMembers.map(({ member, submitted, approved, pending }) => (
                  <tr key={member.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-semibold text-slate-800">
                      {member.full_name}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold">
                      {submitted}
                    </td>
                    <td className="px-2 py-2 text-center font-bold text-emerald-700">
                      {approved}
                    </td>
                    <td className="px-2 py-2 text-center font-semibold text-amber-700">
                      {pending}
                    </td>
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
