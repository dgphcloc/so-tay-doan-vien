import type {
  DbCriterion as Criterion,
  DbCriteriaSection as CriteriaSection,
  DbCriteriaSet as CriteriaSet,
  DbSubCriterion as SubCriterion,
} from '../data/types';

/** Một dòng tiến độ KPI do Đoàn xã giao cho chi đoàn. */
export interface UnitKpiProgress {
  subCriterionId: string;
  criterionName: string;
  subName: string;
  maxScore: number;
  totalTasks: number;
  doneTasks: number;
  pendingTasks: number;
}

export interface KpiSubRow extends UnitKpiProgress {
  order: number;
}
export interface KpiCritNode {
  id: string;
  name: string;
  stt: number;
  subs: KpiSubRow[];
}
export interface KpiSecNode {
  id: string;
  name: string;
  stt: number;
  crits: KpiCritNode[];
}
export interface KpiSetNode {
  id: string;
  name: string;
  year: number;
  archived: boolean;
  secs: KpiSecNode[];
}
export interface KpiYearNode {
  year: number;
  sets: KpiSetNode[];
  /** Toàn bộ bộ của năm này đã lưu trữ. */
  allArchived: boolean;
}

export interface KpiTreeInput {
  kpis: UnitKpiProgress[];
  criteria: Criterion[];
  criteriaSections: CriteriaSection[];
  criteriaSets: CriteriaSet[];
  subCriteria: SubCriterion[];
  /** Năm dùng khi một nội dung không tra được bộ tiêu chí. */
  fallbackYear: number;
}

/**
 * Dựng cây 5 cấp từ danh sách KPI phẳng:
 *   Năm → Bộ tiêu chí → Phần → Tiêu chí → Nội dung
 *
 * Điểm quan trọng: nhiều bộ tiêu chí có thể CÙNG một năm (Đoàn xã ban hành
 * bộ mới giữa năm). Vì vậy khoá nhóm phải là (năm, bộ) chứ không phải chỉ năm —
 * nếu chỉ nhóm theo năm thì hai bộ sẽ bị trộn vào nhau.
 *
 * Hàm thuần, không phụ thuộc React, để kiểm thử được độc lập.
 */
export function buildKpiTree(input: KpiTreeInput): KpiYearNode[] {
  const { kpis, criteria, criteriaSections, criteriaSets, subCriteria, fallbackYear } = input;

  const subOrder = new Map<string, number>();
  subCriteria.forEach((s, i) => subOrder.set(s.id, i));

  const critById = new Map(criteria.map(c => [c.id, c]));
  const secById = new Map(criteriaSections.map(s => [s.id, s]));
  const setById = new Map(criteriaSets.map(s => [s.id, s]));
  const subById = new Map(subCriteria.map(s => [s.id, s]));

  const years = new Map<number, Map<string, KpiSetNode>>();

  for (const k of kpis) {
    const sc = subById.get(k.subCriterionId);
    const crit = sc ? critById.get(sc.criterion_id) : undefined;
    const sec = crit ? secById.get(crit.section_id) : undefined;
    const set = sec ? setById.get(sec.criteria_set_id) : undefined;

    const year = set?.year ?? fallbackYear;
    const setId = set?.id ?? '__none';
    const secId = sec?.id ?? '__none';

    let setsOfYear = years.get(year);
    if (!setsOfYear) { setsOfYear = new Map(); years.set(year, setsOfYear); }

    let setNode = setsOfYear.get(setId);
    if (!setNode) {
      setNode = {
        id: setId,
        name: set?.name ?? 'Chưa rõ bộ tiêu chí',
        year,
        archived: !!set?.archived_at,
        secs: [],
      };
      setsOfYear.set(setId, setNode);
    }

    let secNode = setNode.secs.find(s => s.id === secId);
    if (!secNode) {
      secNode = { id: secId, name: sec?.name ?? 'Khác', stt: sec?.stt ?? 9999, crits: [] };
      setNode.secs.push(secNode);
    }

    const critId = crit?.id ?? '__none';
    let critNode = secNode.crits.find(c => c.id === critId);
    if (!critNode) {
      critNode = {
        id: critId,
        name: crit?.name ?? (k.criterionName || 'Khác'),
        stt: crit?.stt ?? 9999,
        subs: [],
      };
      secNode.crits.push(critNode);
    }

    critNode.subs.push({ ...k, order: subOrder.get(k.subCriterionId) ?? 9999 });
  }

  const out: KpiYearNode[] = [];
  for (const [year, setsOfYear] of years) {
    const sets = [...setsOfYear.values()];
    for (const s of sets) {
      for (const sec of s.secs) {
        for (const c of sec.crits) c.subs.sort((a, b) => a.order - b.order);
        sec.crits.sort((a, b) => a.stt - b.stt);
      }
      s.secs.sort((a, b) => a.stt - b.stt);
    }
    // Trong cùng một năm: bộ đang hoạt động lên trước, rồi theo tên
    sets.sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      return a.name.localeCompare(b.name, 'vi');
    });
    out.push({ year, sets, allArchived: sets.every(s => s.archived) });
  }

  // Năm mới nhất lên đầu
  out.sort((a, b) => b.year - a.year);
  return out;
}

/** Thống kê nhanh một nhánh (dùng cho badge trên từng cấp). */
export function sumKpiRows(subs: Array<UnitKpiProgress | KpiSubRow>) {
  return subs.reduce(
    (a, s) => ({
      total: a.total + s.totalTasks,
      done: a.done + s.doneTasks,
      pending: a.pending + s.pendingTasks,
      noTask: a.noTask + (s.totalTasks === 0 ? 1 : 0),
      score: a.score + s.maxScore,
    }),
    { total: 0, done: 0, pending: 0, noTask: 0, score: 0 }
  );
}

/** Gom toàn bộ nội dung lá của một năm. */
export function flatYearSubs(y: KpiYearNode): KpiSubRow[] {
  return y.sets.flatMap(s => s.secs.flatMap(x => x.crits.flatMap(c => c.subs)));
}
/** Gom toàn bộ nội dung lá của một bộ. */
export function flatSetSubs(s: KpiSetNode): KpiSubRow[] {
  return s.secs.flatMap(x => x.crits.flatMap(c => c.subs));
}