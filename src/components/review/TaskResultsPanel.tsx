import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDateTimeVN } from '../../mock/data';
import type { TaskResult } from '../../types';
import {
  Loader2, ChevronRight, ChevronLeft, Award, Building2, ClipboardList,
  CheckCircle2, XCircle, Clock, Users,
} from 'lucide-react';

/**
 * Tab "Kết quả nhiệm vụ" — drill-down 5 cấp:
 *   Bộ tiêu chí → Tiêu chí → Chi đoàn được giao → Nhiệm vụ → Tiến độ
 *
 * Nhiệm vụ chưa gắn tiêu chí nằm ở nhóm "Nhiệm vụ chưa gắn tiêu chí".
 */

type Crumb = { label: string; onClick: () => void };

interface Level {
  set: string | null;       // criteria_set_id
  criterion: string | null; // criterion id
  unit: string | null;      // unit id
  task: string | null;      // task id
}

const EMPTY: Level = { set: null, criterion: null, unit: null, task: null };

export const TaskResultsPanel: React.FC = () => {
  const {
    criteriaSets, criteriaSections, criteria, subCriteria, taskSubCriteria,
    tasks, taskUnits, taskResults, units,
    yearlySettings, listTaskParticipants, showToast,
  } = useApp();

  const [level, setLevel] = useState<Level>(EMPTY);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listTaskParticipants>> | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);

  // ---- Dữ liệu dẫn xuất ----
  const activeSets = useMemo(
    () => criteriaSets.filter(s => !s.archived_at),
    [criteriaSets]
  );

  const sectionsOf = (setId: string) => criteriaSections.filter(s => s.criteria_set_id === setId);
  const criteriaOf = (setId: string) => {
    const ids = new Set(sectionsOf(setId).map(s => s.id));
    return criteria.filter(c => ids.has(c.section_id));
  };
  const subsOfCriterion = (criterionId: string) => subCriteria.filter(sc => sc.criterion_id === criterionId);

  /** Nhiệm vụ gắn một tiêu chí cụ thể (qua bất kỳ tiêu chí con nào của tiêu chí đó). */
  const tasksOfCriterion = (criterionId: string) => {
    const subIds = new Set(subsOfCriterion(criterionId).map(sc => sc.id));
    const taskIds = new Set(
      taskSubCriteria.filter(t => subIds.has(t.sub_criterion_id)).map(t => t.task_id)
    );
    return tasks.filter(t => taskIds.has(t.id));
  };

  /** Nhiệm vụ không gắn tiêu chí nào. */
  const tasksWithoutCriteria = useMemo(() => {
    const withCriteria = new Set(taskSubCriteria.map(t => t.task_id));
    return tasks.filter(t => !withCriteria.has(t.id));
  }, [tasks, taskSubCriteria]);

  const unitsOfTask = (taskId: string) => {
    const ids = taskUnits.filter(tu => tu.task_id === taskId).map(tu => tu.unit_id);
    return units.filter(u => ids.includes(u.id));
  };

  const resultOf = (taskId: string, unitId: string): TaskResult | null =>
    taskResults.find(r => r.task_id === taskId && r.unit_id === unitId) ?? null;

  // ---- Tải tiến độ đoàn viên khi vào cấp cuối ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!level.task || !level.unit) { setRows(null); return; }
      setLoadingRows(true);
      try {
        const r = await listTaskParticipants(level.task, level.unit);
        if (!cancelled) setRows(r);
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          showToast({ title: 'Không tải được tiến độ', description: e instanceof Error ? e.message : '', type: 'error' });
        }
      } finally {
        if (!cancelled) setLoadingRows(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [level.task, level.unit]);

  // ---- Breadcrumb ----
  const crumbs: Crumb[] = [];
  if (level.set) {
    const set = activeSets.find(s => s.id === level.set);
    crumbs.push({ label: set?.name ?? 'Bộ tiêu chí', onClick: () => setLevel({ ...EMPTY }) });
  }
  if (level.set && level.criterion) {
    const c = criteria.find(x => x.id === level.criterion);
    crumbs.push({ label: c ? `${c.stt}. ${c.name}` : 'Tiêu chí', onClick: () => setLevel({ set: level.set, criterion: null, unit: null, task: null }) });
  }
  if (level.unit) {
    const u = units.find(x => x.id === level.unit);
    crumbs.push({ label: u?.name ?? 'Chi đoàn', onClick: () => setLevel({ ...level, task: null }) });
  }
  if (level.task) {
    const t = tasks.find(x => x.id === level.task);
    crumbs.push({ label: t?.title ?? 'Nhiệm vụ', onClick: () => setLevel(level) });
  }

  const statusChip = (res: TaskResult | null) => {
    if (!res) return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Chưa nộp</span>;
    if (res.status === 'approved') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Đã duyệt</span>;
    if (res.status === 'rejected') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 inline-flex items-center gap-1"><XCircle className="w-3 h-3" /> Từ chối</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</span>;
  };

  // ===== CẤP 1: Bộ tiêu chí =====
  if (!level.set) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Chọn bộ tiêu chí để xem tiến độ hoàn thành nhiệm vụ của các chi đoàn.
        </p>
        <div className="space-y-2">
          {activeSets.map(set => {
            const critCount = criteriaOf(set.id).length;
            return (
              <button
                key={set.id}
                type="button"
                onClick={() => setLevel({ ...EMPTY, set: set.id })}
                className="w-full p-3.5 bg-white rounded-xl border border-slate-200 hover:border-[#1F5FBF] hover:bg-blue-50/30 text-left flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{set.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {critCount} tiêu chí • năm {set.year}
                    {set.id === yearlySettings.criteria_set_id && ' • đang chốt'}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            );
          })}

          {tasksWithoutCriteria.length > 0 && (
            <button
              type="button"
              onClick={() => setLevel({ ...EMPTY, set: '__none__' })}
              className="w-full p-3.5 bg-white rounded-xl border border-dashed border-slate-300 hover:border-slate-400 text-left flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-bold text-slate-700">Nhiệm vụ chưa gắn tiêu chí</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{tasksWithoutCriteria.length} nhiệm vụ</p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== NHÓM ĐẶC BIỆT: nhiệm vụ chưa gắn tiêu chí =====
  if (level.set === '__none__') {
    return (
      <div className="space-y-3">
        <Breadcrumb crumbs={[{ label: 'Bộ tiêu chí', onClick: () => setLevel(EMPTY) }, { label: 'Nhiệm vụ chưa gắn tiêu chí', onClick: () => {} }]} />
        {tasksWithoutCriteria.length === 0 ? (
          <Empty text="Mọi nhiệm vụ đều đã gắn tiêu chí." />
        ) : (
          <div className="space-y-2">
            {tasksWithoutCriteria.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLevel({ ...EMPTY, set: '__none__', task: t.id })}
                className="w-full p-3 bg-white rounded-xl border border-slate-200 hover:border-[#1F5FBF] text-left flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{unitsOfTask(t.id).length} chi đoàn được giao</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== CẤP 2: Tiêu chí trong bộ =====
  if (!level.criterion) {
    const sections = sectionsOf(level.set);
    const crits = criteriaOf(level.set);
    return (
      <div className="space-y-3">
        <Breadcrumb crumbs={crumbs} />
        <div className="space-y-3">
          {sections.map(sec => {
            const inSection = crits.filter(c => c.section_id === sec.id);
            if (inSection.length === 0) return null;
            return (
              <div key={sec.id} className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase text-slate-500">Phần {sec.stt}. {sec.name}</p>
                {inSection.map(c => {
                  const taskCount = tasksOfCriterion(c.id).length;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setLevel({ ...EMPTY, set: level.set, criterion: c.id })}
                      className="w-full p-3 bg-white rounded-lg border border-slate-200 hover:border-[#1F5FBF] text-left flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800">{c.stt}. {c.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {subsOfCriterion(c.id).length} tiêu chí con • {taskCount} nhiệm vụ gắn tiêu chí này
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ===== CẤP 3: Chi đoàn (theo các nhiệm vụ của tiêu chí) =====
  if (!level.unit && !level.task) {
    const critTasks = tasksOfCriterion(level.criterion);
    const unitIds = Array.from(new Set(critTasks.flatMap(t => taskUnits.filter(tu => tu.task_id === t.id).map(tu => tu.unit_id))));
    return (
      <div className="space-y-3">
        <Breadcrumb crumbs={crumbs} />
        {unitIds.length === 0 ? (
          <Empty text="Chưa có nhiệm vụ nào gắn tiêu chí này, nên chưa có chi đoàn nào để theo dõi." />
        ) : (
          <div className="space-y-2">
            {units.filter(u => unitIds.includes(u.id)).map(u => {
              const myTasks = critTasks.filter(t => taskUnits.some(tu => tu.task_id === t.id && tu.unit_id === u.id));
              const done = myTasks.filter(t => resultOf(t.id, u.id)?.status === 'approved').length;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setLevel({ ...level, unit: u.id, task: null })}
                  className="w-full p-3 bg-white rounded-xl border border-slate-200 hover:border-[#1F5FBF] text-left flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Building2 className="w-4 h-4 text-[#1F5FBF] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{u.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {done}/{myTasks.length} nhiệm vụ đã duyệt
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ===== CẤP 4: Nhiệm vụ của chi đoàn =====
  if (level.unit && !level.task) {
    const critTasks = tasksOfCriterion(level.criterion ?? '');
    const myTasks = critTasks.filter(t => taskUnits.some(tu => tu.task_id === t.id && tu.unit_id === level.unit));
    return (
      <div className="space-y-3">
        <Breadcrumb crumbs={crumbs} />
        {myTasks.length === 0 ? (
          <Empty text="Chi đoàn này không có nhiệm vụ nào gắn tiêu chí đang xem." />
        ) : (
          <div className="space-y-2">
            {myTasks.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLevel({ ...level, task: t.id })}
                className="w-full p-3 bg-white rounded-xl border border-slate-200 hover:border-[#1F5FBF] text-left flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ClipboardList className="w-4 h-4 text-slate-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{t.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Hạn {t.due_date}</p>
                  </div>
                </div>
                {statusChip(resultOf(t.id, level.unit!))}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== CẤP 5: Tiến độ chi tiết =====
  const task = tasks.find(t => t.id === level.task);
  const unit = units.find(u => u.id === level.unit);
  const res = level.task && level.unit ? resultOf(level.task, level.unit) : null;

  return (
    <div className="space-y-3">
      <Breadcrumb crumbs={crumbs} />

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">{unit?.name}</p>
            <p className="text-[11px] text-slate-500">{task?.title}</p>
          </div>
          {statusChip(res)}
        </div>

        {res && (
          <p className="text-[11px] text-slate-500">
            Nộp: {formatDateTimeVN(res.completed_at)} • {res.participant_count} người tham gia
            {res.note && <> • <span className="italic">"{res.note}"</span></>}
          </p>
        )}

        {loadingRows ? (
          <div className="p-6 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
        ) : !rows || rows.length === 0 ? (
          <p className="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">Chưa có dữ liệu đoàn viên.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Tổng ĐV" value={rows.length} />
              <Stat label="Đã nộp" value={rows.filter(r => !!r.submission).length} />
              <Stat label="Đã duyệt" value={rows.filter(r => r.submission?.status === 'approved').length} accent />
            </div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              {rows.map(r => {
                const st = r.submission?.status;
                return (
                  <div key={r.member.id} className="p-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs text-slate-800 truncate">{r.member.full_name}</span>
                    </div>
                    {!r.submission ? (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Chưa nộp</span>
                    ) : st === 'approved' ? (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">Đã duyệt</span>
                    ) : st === 'rejected' ? (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">Từ chối</span>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Chờ duyệt</span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Breadcrumb: React.FC<{ crumbs: Crumb[] }> = ({ crumbs }) => (
  <div className="flex flex-wrap items-center gap-1 text-[11px]">
    {crumbs.map((c, i) => (
      <span key={i} className="flex items-center gap-1">
        {i > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
        <button
          type="button"
          onClick={c.onClick}
          className={`font-bold ${i === crumbs.length - 1 ? 'text-slate-700' : 'text-[#1F5FBF] hover:underline'}`}
        >
          {c.label}
        </button>
      </span>
    ))}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">{text}</p>
);

const Stat: React.FC<{ label: string; value: number; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="p-2 bg-slate-50 rounded-lg text-center">
    <p className={`text-base font-extrabold ${accent ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
    <p className="text-[10px] text-slate-500">{label}</p>
  </div>
);
