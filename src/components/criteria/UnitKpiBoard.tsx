import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Target,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ListChecks,
  BarChart3,
  Maximize2,
  Minimize2,
  X,
  CalendarDays,
  FolderOpen,
} from "lucide-react";
import { useApp } from "../../context/AppContext";
import { CreateTaskDropdown } from "../tasks/CreateTaskDropdown";
import { removeVietnameseTones } from "../../utils/vietnamese";
import {
  buildKpiTree,
  sumKpiRows,
  flatYearSubs,
  flatSetSubs,
  type UnitKpiProgress as KpiSubRowBase,
  type KpiYearNode,
  type KpiSetNode,
  type KpiSecNode,
  type KpiCritNode,
  type KpiSubRow,
} from "../../utils/kpiTree";

/** Một dòng tiến độ KPI do Đoàn xã giao cho chi đoàn. */
export type UnitKpiProgress = KpiSubRowBase;

interface Props {
  kpis: UnitKpiProgress[];
  unitId: string;
  /** Gọi sau khi tạo nhiệm vụ để nạp lại tiến độ. */
  onCreated?: () => void;
}

type FilterKey = "all" | "notask" | "doing" | "done";

const norm = (s: string) =>
  removeVietnameseTones(s ?? "")
    .toLowerCase()
    .trim();

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "notask", label: "Chưa tạo nhiệm vụ" },
  { key: "doing", label: "Đang thực hiện" },
  { key: "done", label: "Đã hoàn thành" },
];

/**
 * Bảng tiêu chí Đoàn xã giao cho chi đoàn, tổ chức theo CÂY 4 CẤP:
 *   Năm  →  Bộ tiêu chí  →  Phần  →  Tiêu chí  →  Nội dung (nơi tạo nhiệm vụ).
 *
 * Mục đích: khi Đoàn xã giao hàng chục nội dung, bí thư vẫn nhìn được cấu trúc
 * của bộ tiêu chí trước, rồi mới đi sâu vào từng nội dung để tạo nhiệm vụ.
 * Cấp Năm / Bộ chỉ hiện khi thực tế có nhiều hơn một — dữ liệu một bộ vẫn gọn.
 */
export const UnitKpiBoard: React.FC<Props> = ({ kpis, unitId, onCreated }) => {
  const {
    criteria,
    criteriaSections,
    criteriaSets,
    subCriteria,
    getSubCriterionById,
  } = useApp();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  // null = dùng trạng thái mặc định (mở năm hiện tại, đóng năm cũ)
  const [openYears, setOpenYears] = useState<Set<number> | null>(null);
  const [openSets, setOpenSets] = useState<Set<string> | null>(null);
  const [openSections, setOpenSections] = useState<Set<string> | null>(null);
  const [openCrits, setOpenCrits] = useState<Set<string> | null>(null);

  const nowYear = new Date().getFullYear();

  /** Dựng cây Năm → Bộ → Phần → Tiêu chí → Nội dung (logic thuần ở utils/kpiTree). */
  const tree = useMemo(
    () =>
      buildKpiTree({
        kpis,
        criteria,
        criteriaSections,
        criteriaSets,
        subCriteria,
        fallbackYear: nowYear,
      }),
    [kpis, criteria, criteriaSections, criteriaSets, subCriteria, nowYear],
  );

  const q = norm(query);

  const passesFilter = (s: KpiSubRow): boolean => {
    if (filter === "notask") return s.totalTasks === 0;
    if (filter === "doing")
      return s.totalTasks > 0 && s.doneTasks < s.totalTasks;
    if (filter === "done")
      return s.totalTasks > 0 && s.doneTasks >= s.totalTasks;
    return true;
  };

  /** Lọc theo ô tìm kiếm + chip trạng thái, bỏ nhánh rỗng ở mọi cấp. */
  const filtered = useMemo(() => {
    const res: KpiYearNode[] = [];

    for (const y of tree) {
      const yearHit = !!q && String(y.year).includes(q);
      const sets: KpiSetNode[] = [];

      for (const set of y.sets) {
        const setHit = yearHit || (!!q && norm(set.name).includes(q));
        const secs: KpiSecNode[] = [];

        for (const sec of set.secs) {
          const secHit = setHit || (!!q && norm(sec.name).includes(q));
          const crits: KpiCritNode[] = [];

          for (const c of sec.crits) {
            const critHit = secHit || (!!q && norm(c.name).includes(q));
            const subs = c.subs.filter(
              (s) =>
                passesFilter(s) &&
                (!q || critHit || norm(s.subName).includes(q)),
            );
            if (subs.length > 0) crits.push({ ...c, subs });
          }

          if (crits.length > 0) secs.push({ ...sec, crits });
        }

        if (secs.length > 0) sets.push({ ...set, secs });
      }

      if (sets.length > 0)
        res.push({ ...y, sets, allArchived: sets.every((s) => s.archived) });
    }

    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, filter, q]);

  // Khoá định danh cho các cấp (Chỉ dùng để gập/mở)
  const allYears = useMemo(() => filtered.map((y) => y.year), [filtered]);
  const allSetKeys = useMemo(
    () => filtered.flatMap((y) => y.sets.map((s) => s.id)),
    [filtered],
  );
  const allSecIds = useMemo(
    () =>
      filtered.flatMap((y) => y.sets.flatMap((s) => s.secs.map((x) => x.id))),
    [filtered],
  );
  const allCritKeys = useMemo(
    () =>
      filtered.flatMap((y) =>
        y.sets.flatMap((s) =>
          s.secs.flatMap((x) =>
            x.crits.map((c) => `${s.id}::${x.id}::${c.id}`),
          ),
        ),
      ),
    [filtered],
  );

  // Mặc định: mở năm hiện tại (và các năm mới hơn), đóng năm cũ
  const defaultYears = useMemo(
    () => new Set(allYears.filter((y) => y >= nowYear)),
    [allYears, nowYear],
  );

  // Khi đang tìm kiếm / lọc thì luôn mở hết để thấy ngay kết quả
  const forceExpand = q.length > 0 || filter !== "all";
  const isYearOpen = (y: number) =>
    forceExpand || (openYears ? openYears.has(y) : defaultYears.has(y));
  const isSetOpen = (id: string) =>
    forceExpand || (openSets ? openSets.has(id) : true);
  const isSecOpen = (id: string) =>
    forceExpand || (openSections ? openSections.has(id) : true);
  const isCritOpen = (key: string) =>
    forceExpand || (openCrits ? openCrits.has(key) : false);

  const toggle = <T,>(cur: Set<T> | null, fallback: Set<T>, key: T): Set<T> => {
    const next = new Set(cur ?? fallback);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };
  const expandAll = () => {
    setOpenYears(new Set(allYears));
    setOpenSets(new Set(allSetKeys));
    setOpenSections(new Set(allSecIds));
    setOpenCrits(new Set(allCritKeys));
  };
  const collapseAll = () => {
    setOpenYears(new Set());
    setOpenSets(new Set());
    setOpenSections(new Set());
    setOpenCrits(new Set());
  };

  const sum = sumKpiRows;
  const flatSubs = flatYearSubs;
  const rootStats = sum(kpis.map((k) => ({ ...k, order: 0 })));

  // Cấp Năm / Bộ chỉ hiện khi cần: có nhiều năm, hoặc một năm có nhiều bộ.
  // Dữ liệu chỉ một bộ duy nhất vẫn giữ giao diện gọn như trước.
  const showYearLevel = tree.length > 1;
  const showSetLevel = showYearLevel || tree.some((y) => y.sets.length > 1);

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-xs overflow-hidden">
      {/* ===== Đầu thẻ ===== */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-doan shrink-0" />
              <span className="truncate">
                Tiêu chí Đoàn xã giao cho chi đoàn ({kpis.length})
              </span>
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Đi theo cây <b>Năm → Bộ tiêu chí → Phần → Tiêu chí → Nội dung</b>.
              Mỗi nội dung cần được triển khai bằng ít nhất một nhiệm vụ.
            </p>
          </div>
          <Link
            to="/bao-cao-chi-doan"
            title="Xem báo cáo tổng hợp và xuất Excel để nộp Đoàn xã"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-doan bg-white border border-blue-300 hover:bg-blue-50 rounded-lg whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5" /> Báo cáo chi đoàn
          </Link>
        </div>

        {/* Tổng hợp toàn bộ */}
        <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/80 border border-slate-200 text-slate-700 font-semibold">
            <Layers className="w-3 h-3 text-doan shrink-0" />
            {tree.length} năm · {tree.reduce((a, y) => a + y.sets.length, 0)} bộ
            tiêu chí
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/80 border border-slate-200 text-slate-600 font-semibold">
            {rootStats.done}/{rootStats.total} nhiệm vụ đã duyệt
          </span>
          <span className="px-2 py-1 rounded-lg bg-white/80 border border-slate-200 text-amber-700 font-semibold">
            {rootStats.score} điểm tối đa
          </span>
          {rootStats.noTask > 0 && (
            <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {rootStats.noTask} nội dung
              chưa có nhiệm vụ
            </span>
          )}
        </div>
      </div>

      {kpis.length === 0 ? (
        <div className="p-6 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-700">
            Chưa có tiêu chí nào được giao cho chi đoàn
          </p>
          <p className="mt-1">
            Đoàn xã cần vào <b>Tiêu chí</b> → chọn tiêu chí con → mục
            <b> "Phân công chi đoàn thực hiện"</b> và tick chi đoàn của bạn.
          </p>
        </div>
      ) : (
        <>
          {/* ===== Thanh công cụ: tìm kiếm + lọc + mở/đóng ===== */}
          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[12rem]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo năm, bộ, phần, tiêu chí hoặc nội dung…"
                className="w-full pl-8 pr-7 py-1.5 text-[11px] bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-doan"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  title="Xóa từ khóa tìm kiếm"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  title={
                    f.key === "all"
                      ? "Hiện tất cả nội dung được giao"
                      : f.key === "notask"
                        ? "Chỉ hiện nội dung chưa có nhiệm vụ nào"
                        : f.key === "doing"
                          ? "Chỉ hiện nội dung đang làm, chưa xong hết"
                          : "Chỉ hiện nội dung đã hoàn thành"
                  }
                  className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                    filter === f.key
                      ? "bg-doan text-white border-doan"
                      : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={expandAll}
                title="Mở rộng toàn bộ Năm, Bộ, Phần và Tiêu chí"
                className="p-1.5 text-slate-500 hover:text-doan bg-white border border-slate-300 rounded-lg"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={collapseAll}
                title="Thu gọn toàn bộ Năm, Bộ, Phần và Tiêu chí"
                className="p-1.5 text-slate-500 hover:text-doan bg-white border border-slate-300 rounded-lg"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ===== Cây tiêu chí ===== */}
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Không có nội dung nào khớp bộ lọc hiện tại.
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
                title="Bỏ từ khóa và bộ lọc để xem lại toàn bộ"
                className="ml-1 font-bold text-doan hover:underline"
              >
                Xem tất cả
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filtered.map((y) => {
                const yearOpen = isYearOpen(y.year);
                const yearStats = sum(flatSubs(y));
                const isOld = y.year < nowYear;

                return (
                  <div key={y.year}>
                    {/* --- Cấp NĂM (chỉ hiện khi có nhiều năm) --- */}
                    {showYearLevel && (
                      <button
                        type="button"
                        onClick={() =>
                          setOpenYears(toggle(openYears, defaultYears, y.year))
                        }
                        title={yearOpen ? "Thu gọn năm này" : "Mở rộng năm này"}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-slate-200 ${
                          isOld
                            ? "bg-amber-50/70 hover:bg-amber-50"
                            : "bg-slate-200/70 hover:bg-slate-200/90"
                        }`}
                      >
                        {yearOpen ? (
                          <ChevronDown className="w-4 h-4 text-slate-600 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                        <CalendarDays
                          className={`w-3.5 h-3.5 shrink-0 ${isOld ? "text-amber-600" : "text-doan"}`}
                        />
                        <span className="text-xs font-bold text-slate-900 shrink-0">
                          Năm {y.year}
                        </span>
                        {isOld && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded whitespace-nowrap">
                            Niên độ đã kết thúc
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-600 flex-1 min-w-0 truncate">
                          {y.sets.length} bộ ·{" "}
                          {y.sets.reduce((a, s) => a + s.secs.length, 0)} phần
                        </span>
                        {yearStats.noTask > 0 && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                            {yearStats.noTask} chưa có NV
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                            yearStats.total > 0 &&
                            yearStats.done >= yearStats.total
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-white text-slate-700 border border-slate-300"
                          }`}
                        >
                          {yearStats.done}/{yearStats.total} duyệt
                        </span>
                      </button>
                    )}

                    {yearOpen &&
                      y.sets.map((set) => {
                        const setOpen = isSetOpen(set.id);
                        const setStats = sum(flatSetSubs(set));

                        return (
                          <div key={set.id}>
                            {/* --- Cấp BỘ TIÊU CHÍ --- */}
                            {(showYearLevel || showSetLevel) && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSets(
                                    toggle(
                                      openSets,
                                      new Set(allSetKeys),
                                      set.id,
                                    ),
                                  )
                                }
                                title={
                                  setOpen
                                    ? "Thu gọn bộ tiêu chí này"
                                    : "Mở rộng bộ tiêu chí này"
                                }
                                className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-100/80 hover:bg-slate-100 text-left border-b border-slate-200"
                              >
                                {setOpen ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                                <FolderOpen className="w-3.5 h-3.5 text-doan shrink-0" />
                                <span className="text-[11px] font-bold text-slate-800 flex-1 min-w-0 truncate">
                                  {set.name}
                                </span>
                                {set.archived && (
                                  <span className="text-[10px] font-bold text-slate-600 bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    Đã lưu trữ
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                                  {set.secs.length} phần ·{" "}
                                  {set.secs.reduce(
                                    (a, s) => a + s.crits.length,
                                    0,
                                  )}{" "}
                                  tiêu chí
                                </span>
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                                  {setStats.score} điểm
                                </span>
                                {setStats.noTask > 0 && (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                    {setStats.noTask} chưa có NV
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                                    setStats.total > 0 &&
                                    setStats.done >= setStats.total
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {setStats.done}/{setStats.total} duyệt
                                </span>
                              </button>
                            )}

                            {setOpen &&
                              set.secs.map((sec) => {
                                const secOpen = isSecOpen(sec.id);
                                const secSubs = sec.crits.flatMap(
                                  (c) => c.subs,
                                );
                                const secStats = sum(secSubs);

                                return (
                                  <div key={sec.id}>
                                    {/* --- Cấp PHẦN --- */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenSections(
                                          toggle(
                                            openSections,
                                            new Set(allSecIds),
                                            sec.id,
                                          ),
                                        )
                                      }
                                      title={
                                        secOpen
                                          ? "Thu gọn phần này"
                                          : "Mở rộng phần này để xem các tiêu chí"
                                      }
                                      className="w-full flex items-center gap-2 pl-6 pr-4 py-2 bg-slate-50 hover:bg-slate-100 text-left border-b border-slate-100"
                                    >
                                      {secOpen ? (
                                        <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                                      )}
                                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide flex-1 min-w-0 truncate">
                                        {sec.name}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
                                        {sec.crits.length} tiêu chí ·{" "}
                                        {secSubs.length} nội dung
                                      </span>
                                      {secStats.noTask > 0 && (
                                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                          {secStats.noTask} chưa có NV
                                        </span>
                                      )}
                                      <span
                                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                                          secStats.total > 0 &&
                                          secStats.done >= secStats.total
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "bg-slate-200 text-slate-700"
                                        }`}
                                      >
                                        {secStats.done}/{secStats.total} duyệt
                                      </span>
                                    </button>

                                    {secOpen && (
                                      <div className="divide-y divide-slate-100">
                                        {sec.crits.map((crit) => {
                                          const key = `${set.id}::${sec.id}::${crit.id}`;
                                          const critOpen = isCritOpen(key);
                                          const critStats = sum(crit.subs);

                                          return (
                                            <div key={key}>
                                              {/* --- Cấp TIÊU CHÍ --- */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setOpenCrits(
                                                    toggle(
                                                      openCrits,
                                                      new Set(allCritKeys),
                                                      key,
                                                    ),
                                                  )
                                                }
                                                title={
                                                  critOpen
                                                    ? "Thu gọn tiêu chí này"
                                                    : "Mở rộng tiêu chí này để xem các nội dung"
                                                }
                                                className="w-full flex items-center gap-2 pl-10 pr-4 py-2 bg-white hover:bg-slate-50 text-left"
                                              >
                                                {critOpen ? (
                                                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                                ) : (
                                                  <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                                                )}
                                                <span className="text-[11px] font-bold text-doan shrink-0">
                                                  Tiêu chí{" "}
                                                  {crit.stt < 9999
                                                    ? crit.stt
                                                    : "—"}
                                                </span>
                                                <span className="text-[11px] font-semibold text-slate-800 flex-1 min-w-0 truncate">
                                                  {crit.name}
                                                </span>
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                                                  {crit.subs.length} nội dung
                                                </span>
                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                  Tối đa{" "}
                                                  {crit.subs.reduce(
                                                    (a, s) => a + s.maxScore,
                                                    0,
                                                  )}{" "}
                                                  điểm
                                                </span>
                                                {critStats.noTask > 0 && (
                                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                    {critStats.noTask} chưa có
                                                    NV
                                                  </span>
                                                )}
                                                {critStats.total > 0 &&
                                                  critStats.done >=
                                                    critStats.total && (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded whitespace-nowrap inline-flex items-center gap-0.5">
                                                      <CheckCircle2 className="w-2.5 h-2.5" />{" "}
                                                      Xong
                                                    </span>
                                                  )}
                                              </button>

                                              {/* --- Cấp NỘI DUNG (nơi tạo nhiệm vụ) --- */}
                                              {critOpen && (
                                                <div className="divide-y divide-slate-100 bg-slate-50/40">
                                                  {crit.subs.map((k, idx) => {
                                                    const pct =
                                                      k.totalTasks > 0
                                                        ? Math.round(
                                                            (k.doneTasks /
                                                              k.totalTasks) *
                                                              100,
                                                          )
                                                        : 0;
                                                    const done =
                                                      k.totalTasks > 0 &&
                                                      k.doneTasks >=
                                                        k.totalTasks;

                                                    return (
                                                      <div
                                                        key={k.subCriterionId}
                                                        className="pl-14 pr-4 py-2.5"
                                                      >
                                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                                          <div className="flex-1 min-w-0">
                                                            <div className="flex items-start gap-1.5">
                                                              <ListChecks className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                                                              <p className="text-xs text-slate-800 leading-snug">
                                                                <span className="font-bold text-slate-500 mr-1">
                                                                  {crit.stt <
                                                                  9999
                                                                    ? `${crit.stt}.${idx + 1}`
                                                                    : `${idx + 1}.`}
                                                                </span>
                                                                {k.subName}
                                                              </p>
                                                            </div>

                                                            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                                Tối đa{" "}
                                                                {k.maxScore}{" "}
                                                                điểm
                                                              </span>
                                                              {k.totalTasks ===
                                                                0 && (
                                                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                                                                  Chưa tạo nhiệm
                                                                  vụ
                                                                </span>
                                                              )}
                                                              {done && (
                                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                                                  <CheckCircle2 className="w-2.5 h-2.5" />{" "}
                                                                  Đã hoàn thành
                                                                </span>
                                                              )}
                                                              {k.pendingTasks >
                                                                0 && (
                                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                                                  {
                                                                    k.pendingTasks
                                                                  }{" "}
                                                                  chờ duyệt
                                                                </span>
                                                              )}
                                                            </div>

                                                            {k.totalTasks >
                                                              0 && (
                                                              <div className="mt-1.5 flex items-center gap-2">
                                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-xs">
                                                                  <div
                                                                    className={`h-1.5 rounded-full transition-all ${done ? "bg-emerald-500" : "bg-doan"}`}
                                                                    style={{
                                                                      width: `${pct}%`,
                                                                    }}
                                                                  />
                                                                </div>
                                                                <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                                                                  {k.doneTasks}/
                                                                  {k.totalTasks}{" "}
                                                                  nhiệm vụ đã
                                                                  duyệt
                                                                </span>
                                                              </div>
                                                            )}
                                                          </div>

                                                          <CreateTaskDropdown
                                                            subCriterionId={
                                                              k.subCriterionId
                                                            }
                                                            subName={k.subName}
                                                            maxScore={
                                                              k.maxScore
                                                            }
                                                            unitId={unitId}
                                                            onCreated={
                                                              onCreated
                                                            }
                                                            disabledReason={
                                                              k.totalTasks > 0
                                                                ? "Chi đoàn đã tạo nhiệm vụ cho tiêu chí này rồi. Mỗi tiêu chí chỉ một nhiệm vụ."
                                                                : undefined
                                                            }
                                                          />
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
