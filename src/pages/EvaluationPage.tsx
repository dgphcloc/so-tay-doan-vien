import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useApp } from "../context/AppContext";
import { Avatar } from "../components/common/Avatar";
import { useConfirm } from "../components/common/ConfirmDialog";
import {
  CalendarDays,
  Award,
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Lock,
  Unlock,
  Save,
  X,
  Search,
  MessageSquareWarning,
  ShieldAlert,
  Plus,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import {
  DbEvaluationPeriod,
  DbMemberEvaluation,
  DbUnitEvaluation,
  DbMemberDiscipline,
  DbMemberRldvLevel,
  RatingLevel,
  RATING_LABELS,
  RATING_SHORT_LABELS,
  DISCIPLINE_LABELS,
  DisciplineForm,
  PeriodStatus,
} from "../data/types";
import {
  computeMemberRating,
  hasStrictDisciplineInPeriod,
} from "../utils/evaluationRules";
import { removeVietnameseTones } from "../utils/vietnamese";

// ---------------------------------------------------------------------
// Hằng dùng chung
// ---------------------------------------------------------------------
const RATING_ORDER: RatingLevel[] = [
  "excellent",
  "good",
  "pass",
  "fail",
  "not_rated",
];

const RATING_BADGE: Record<RatingLevel, string> = {
  excellent: "bg-emerald-100 text-emerald-800 border-emerald-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  pass: "bg-amber-100 text-amber-800 border-amber-200",
  fail: "bg-rose-100 text-rose-800 border-rose-200",
  not_rated: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_LABEL: Record<string, string> = {
  auto: "Chờ đoàn viên xác nhận",
  member_responded: "Đoàn viên đã phản hồi",
  secretary_done: "Chờ Bí thư xã chốt",
  finalized: "Đã chốt",
};

const STATUS_BADGE: Record<string, string> = {
  auto: "bg-slate-100 text-slate-700 border-slate-200",
  member_responded: "bg-amber-100 text-amber-800 border-amber-200",
  secretary_done: "bg-blue-100 text-blue-800 border-blue-200",
  finalized: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const PERIOD_STATUS_LABEL: Record<PeriodStatus, string> = {
  draft: "Chưa mở",
  open: "Đang đánh giá",
  closed: "Đã đóng",
};

const PERIOD_STATUS_BADGE: Record<PeriodStatus, string> = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  open: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-slate-800 text-white border-slate-800",
};

/** Định dạng dd/mm/yyyy từ chuỗi YYYY-MM-DD mà không bị lệch múi giờ. */
const fmtDate = (iso: string): string => {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d || "—";
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
};

const RatingBadge: React.FC<{ level: RatingLevel | null }> = ({ level }) => {
  const l = level || "not_rated";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold ${RATING_BADGE[l]}`}
    >
      {RATING_SHORT_LABELS[l]}
    </span>
  );
};

type TabKey = "periods" | "members" | "units" | "discipline";

export const EvaluationPage: React.FC = () => {
  const {
    currentRole,
    currentMember,
    members,
    units,
    showToast,
    listEvaluationPeriods,
    saveEvaluationPeriod,
    setEvaluationPeriodStatus,
    listMemberRldvLevels,
    saveMemberRldvLevel,
    listMemberDisciplines,
    saveMemberDiscipline,
    deleteMemberDiscipline,
    listMemberEvaluations,
    generateMemberEvaluations,
    saveMemberEvaluationResponse,
    reviewMemberEvaluation,
    finalizeMemberEvaluation,
    listUnitEvaluations,
    generateUnitEvaluations,
    finalizeUnitEvaluation,
    listUnionFeePayments,
  } = useApp();

  const { confirm, prompt: promptDialog } = useConfirm();

  const isAdmin = currentRole === "super_admin" || currentRole === "admin";
  const isSecretary = currentRole === "unit_secretary";
  const isMember = currentRole === "member";

  const [tab, setTab] = useState<TabKey>(isAdmin ? "periods" : "members");
  const [periods, setPeriods] = useState<DbEvaluationPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [memberEvals, setMemberEvals] = useState<DbMemberEvaluation[]>([]);
  const [unitEvals, setUnitEvals] = useState<DbUnitEvaluation[]>([]);
  const [rldvLevels, setRldvLevels] = useState<DbMemberRldvLevel[]>([]);
  const [disciplines, setDisciplines] = useState<DbMemberDiscipline[]>([]);
  const [feePayments, setFeePayments] = useState<any[]>([]);

  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState<"all" | RatingLevel>("all");

  const activePeriod = periods.find((p) => p.id === activePeriodId) || null;
  const myUnitId = currentMember?.unit_id || "";

  // -------------------------------------------------------------------
  // Nạp dữ liệu
  // -------------------------------------------------------------------
  const loadPeriods = useCallback(async () => {
    const list = await listEvaluationPeriods();
    setPeriods(list);
    setActivePeriodId((prev) => {
      if (prev && list.some((p) => p.id === prev)) return prev;
      return list[0]?.id ?? "";
    });
  }, [listEvaluationPeriods]);

  const loadPeriodData = useCallback(
    async (periodId: string, year: number) => {
      if (!periodId) {
        setMemberEvals([]);
        setUnitEvals([]);
        setRldvLevels([]);
        setDisciplines([]);
        return;
      }
      const [me, ue, rl, dc, fp] = await Promise.all([
        listMemberEvaluations(periodId),
        listUnitEvaluations(periodId),
        listMemberRldvLevels(year),
        listMemberDisciplines({ year }),
        listUnionFeePayments({ year }),
      ]);
      setMemberEvals(me);
      setUnitEvals(ue);
      setRldvLevels(rl);
      setDisciplines(dc);
      setFeePayments(fp);
    },
    [
      listMemberEvaluations,
      listUnitEvaluations,
      listMemberRldvLevels,
      listMemberDisciplines,
      listUnionFeePayments,
    ],
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadPeriods();
      } catch (err) {
        showToast({
          title: "Không tải được kỳ đánh giá",
          description:
            err instanceof Error ? err.message : "Lỗi không xác định",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [loadPeriods, showToast]);

  useEffect(() => {
    if (!activePeriod) return;
    (async () => {
      try {
        await loadPeriodData(activePeriod.id, activePeriod.year);
      } catch (err) {
        showToast({
          title: "Không tải được dữ liệu kỳ",
          description:
            err instanceof Error ? err.message : "Lỗi không xác định",
          type: "error",
        });
      }
    })();
  }, [activePeriod?.id, loadPeriodData, showToast]);

  // -------------------------------------------------------------------
  // Bản đồ tra cứu
  // -------------------------------------------------------------------
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  );
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);
  const rldvByMember = useMemo(
    () => new Map(rldvLevels.map((r) => [r.member_id, r])),
    [rldvLevels],
  );

  const disByMember = useMemo(() => {
    const map = new Map<string, DbMemberDiscipline[]>();
    for (const d of disciplines) {
      map.set(d.member_id, [...(map.get(d.member_id) || []), d]);
    }
    return map;
  }, [disciplines]);

  // -------------------------------------------------------------------
  // Lọc danh sách đoàn viên theo vai trò + bộ lọc
  // -------------------------------------------------------------------
  const visibleMemberEvals = useMemo(() => {
    let list = memberEvals;

    // Đoàn viên: chỉ thấy phiếu của mình
    if (isMember) {
      list = list.filter((e) => e.member_id === currentMember?.id);
    }
    // Bí thư chi đoàn: chỉ chi đoàn mình
    else if (isSecretary) {
      list = list.filter((e) => e.unit_id === myUnitId);
    }

    if (unitFilter !== "all")
      list = list.filter((e) => e.unit_id === unitFilter);
    if (ratingFilter !== "all") {
      list = list.filter(
        (e) =>
          (e.admin_rating || e.secretary_rating || e.auto_rating) ===
          ratingFilter,
      );
    }
    if (search.trim()) {
      const q = removeVietnameseTones(search.trim().toLowerCase());
      list = list.filter((e) => {
        const m = memberById.get(e.member_id);
        const u = unitById.get(e.unit_id);
        const text = removeVietnameseTones(
          `${m?.full_name || ""} ${u?.name || ""}`.toLowerCase(),
        );
        return text.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const na = memberById.get(a.member_id)?.full_name || "";
      const nb = memberById.get(b.member_id)?.full_name || "";
      return na.localeCompare(nb, "vi");
    });
  }, [
    memberEvals,
    isMember,
    isSecretary,
    currentMember?.id,
    myUnitId,
    unitFilter,
    ratingFilter,
    search,
    memberById,
    unitById,
  ]);

  // -------------------------------------------------------------------
  // Thống kê nhanh
  // -------------------------------------------------------------------
  const stats = useMemo(() => {
    const base = isMember
      ? memberEvals.filter((e) => e.member_id === currentMember?.id)
      : isSecretary
        ? memberEvals.filter((e) => e.unit_id === myUnitId)
        : memberEvals;
    const count = (lv: RatingLevel) =>
      base.filter(
        (e) => (e.admin_rating || e.secretary_rating || e.auto_rating) === lv,
      ).length;
    return {
      total: base.length,
      excellent: count("excellent"),
      good: count("good"),
      pass: count("pass"),
      fail: count("fail"),
      pending: base.filter((e) => e.status !== "finalized").length,
    };
  }, [memberEvals, isMember, isSecretary, currentMember?.id, myUnitId]);

  // Hàng đợi duyệt của bí thư chi đoàn
  const secretaryQueue = useMemo(
    () =>
      isSecretary
        ? memberEvals.filter(
            (e) => e.unit_id === myUnitId && e.status !== "finalized",
          )
        : [],
    [memberEvals, isSecretary, myUnitId],
  );

  // -------------------------------------------------------------------
  // Hành động
  // -------------------------------------------------------------------
  const run = async (
    key: string,
    fn: () => Promise<any>,
    successMsg?: string,
  ) => {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fn();
      if (res && res.success === false) {
        showToast({
          title: "Không thực hiện được",
          description: res.message,
          type: "error",
        });
        return;
      }
      if (successMsg) showToast({ title: successMsg, type: "success" });
      if (activePeriod)
        await loadPeriodData(activePeriod.id, activePeriod.year);
      await loadPeriods();
    } catch (err) {
      showToast({
        title: "Có lỗi xảy ra",
        description: err instanceof Error ? err.message : "Lỗi không xác định",
        type: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  // -------------------------------------------------------------------
  // Modal: tạo kỳ
  // -------------------------------------------------------------------
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formType, setFormType] = useState<"calendar" | "school_year">(
    "calendar",
  );
  const [formName, setFormName] = useState("");

  const openPeriodModal = () => {
    const y = new Date().getFullYear();
    setFormYear(y);
    setFormType("calendar");
    setFormName(`Đánh giá, xếp loại năm ${y}`);
    setIsPeriodModalOpen(true);
  };

  // -------------------------------------------------------------------
  // Modal: chi tiết phiếu đoàn viên
  // -------------------------------------------------------------------
  const [detail, setDetail] = useState<DbMemberEvaluation | null>(null);
  const [detailRating, setDetailRating] = useState<RatingLevel>("not_rated");
  const [detailNote, setDetailNote] = useState("");
  const [memberFeedback, setMemberFeedback] = useState("");

  const openDetail = (ev: DbMemberEvaluation) => {
    setDetail(ev);
    setDetailRating(ev.secretary_rating || ev.auto_rating);
    setDetailNote(ev.secretary_note || "");
    setMemberFeedback("");
  };

  // -------------------------------------------------------------------
  // Modal: chi tiết phiếu chi đoàn
  // -------------------------------------------------------------------
  const [unitDetail, setUnitDetail] = useState<DbUnitEvaluation | null>(null);
  const [unitRating, setUnitRating] = useState<RatingLevel>("not_rated");
  const [unitNote, setUnitNote] = useState("");
  const [unitMeetingOk, setUnitMeetingOk] = useState(false);
  const [unitFeeOk, setUnitFeeOk] = useState(false);
  const [unitHasDiscipline, setUnitHasDiscipline] = useState(false);

  const openUnitDetail = (ev: DbUnitEvaluation) => {
    setUnitDetail(ev);
    setUnitRating(ev.final_rating || ev.auto_rating);
    setUnitNote(ev.note || "");
    setUnitMeetingOk(ev.meeting_ok);
    setUnitFeeOk(ev.fee_ok);
    setUnitHasDiscipline(ev.has_discipline);
  };

  // -------------------------------------------------------------------
  // Modal: kỷ luật
  // -------------------------------------------------------------------
  const [isDiscModalOpen, setIsDiscModalOpen] = useState(false);
  const [discMemberId, setDiscMemberId] = useState("");
  const [discDecisionNo, setDiscDecisionNo] = useState("");
  const [discForm, setDiscForm] = useState<DisciplineForm>("reprimand");
  const [discDecidedAt, setDiscDecidedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [discReason, setDiscReason] = useState("");
  const [discSearch, setDiscSearch] = useState("");

  const discCandidates = useMemo(() => {
    const q = removeVietnameseTones(discSearch.trim().toLowerCase());
    const list = q
      ? members.filter((m) =>
          removeVietnameseTones(m.full_name.toLowerCase()).includes(q),
        )
      : members;
    return list.slice(0, 50);
  }, [members, discSearch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang tải dữ liệu đánh
        giá…
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-16">
      {/* Tiêu đề */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-doan" />
            Đánh giá, xếp loại hằng năm
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo Hướng dẫn 25-HD/TWĐTN-BTC ngày 13/9/2023 — máy tính tự động,
            đoàn viên xác nhận, bí thư chi đoàn duyệt, bí thư xã chốt.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {periods.length > 0 && (
            <select
              value={activePeriodId}
              onChange={(e) => setActivePeriodId(e.target.value)}
              className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({PERIOD_STATUS_LABEL[p.status]})
                </option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button
              title="Tạo kỳ đánh giá"
              type="button"
              onClick={openPeriodModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-doan hover:bg-doan-dark rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Tạo kỳ đánh giá
            </button>
          )}
        </div>
      </div>

      {periods.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
          Chưa có kỳ đánh giá nào.{" "}
          {isAdmin
            ? 'Bấm "Tạo kỳ đánh giá" để bắt đầu.'
            : "Vui lòng chờ Bí thư xã tạo kỳ đánh giá."}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {isAdmin && (
          <button
            title="Kỳ đánh giá"
            type="button"
            onClick={() => setTab("periods")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === "periods" ? "bg-white shadow-xs text-doan" : "text-slate-600"}`}
          >
            <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
            Kỳ đánh giá
          </button>
        )}
        <button
          title="Đoàn viên"
          type="button"
          onClick={() => setTab("members")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === "members" ? "bg-white shadow-xs text-doan" : "text-slate-600"}`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1" />
          {isMember ? "Kết quả của tôi" : "Xếp loại đoàn viên"}
        </button>
        {!isMember && (
          <button
            title="Xếp loại chi đoàn"
            type="button"
            onClick={() => setTab("units")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === "units" ? "bg-white shadow-xs text-doan" : "text-slate-600"}`}
          >
            <Building2 className="w-3.5 h-3.5 inline mr-1" />
            Xếp loại chi đoàn
          </button>
        )}
        {isAdmin && (
          <button
            title="Kỷ luật"
            type="button"
            onClick={() => setTab("discipline")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${tab === "discipline" ? "bg-white shadow-xs text-doan" : "text-slate-600"}`}
          >
            <ShieldAlert className="w-3.5 h-3.5 inline mr-1" />
            Kỷ luật
          </button>
        )}
      </div>

      {/* ================= TAB: KỲ ĐÁNH GIÁ ================= */}
      {tab === "periods" && isAdmin && (
        <div className="space-y-3">
          {periods.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{p.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${PERIOD_STATUS_BADGE[p.status]}`}
                  >
                    {PERIOD_STATUS_LABEL[p.status]}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {fmtDate(p.start_date)} → {fmtDate(p.end_date)} ·{" "}
                  {p.period_type === "school_year"
                    ? "Năm học"
                    : "Năm dương lịch"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  title="Sinh phiếu đánh giá cho toàn bộ đoàn viên trong kỳ"
                  type="button"
                  disabled={busy === `gen-m-${p.id}`}
                  onClick={() =>
                    run(
                      `gen-m-${p.id}`,
                      () =>
                        generateMemberEvaluations(p.id, { recompute: false }),
                      "Đã tạo phiếu đánh giá đoàn viên",
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg disabled:opacity-60"
                >
                  {busy === `gen-m-${p.id}` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Tạo phiếu đoàn viên
                </button>
                <button
                  title="Sinh phiếu đánh giá cho toàn bộ chi đoàn trong kỳ"
                  type="button"
                  disabled={busy === `gen-u-${p.id}`}
                  onClick={() =>
                    run(
                      `gen-u-${p.id}`,
                      () => generateUnitEvaluations(p.id),
                      "Đã tạo phiếu đánh giá chi đoàn",
                    )
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-300 rounded-lg disabled:opacity-60"
                >
                  {busy === `gen-u-${p.id}` ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Tạo phiếu chi đoàn
                </button>
                {p.status === "draft" && (
                  <button
                    title="Mở kỳ"
                    type="button"
                    onClick={() =>
                      run(
                        `st-${p.id}`,
                        () => setEvaluationPeriodStatus(p.id, "open"),
                        "Đã mở kỳ đánh giá",
                      )
                    }
                    className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                  >
                    Mở kỳ
                  </button>
                )}
                {p.status === "open" && (
                  <button
                    title="Đóng kỳ"
                    type="button"
                    onClick={() =>
                      run(
                        `st-${p.id}`,
                        () => setEvaluationPeriodStatus(p.id, "closed"),
                        "Đã đóng kỳ đánh giá",
                      )
                    }
                    className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg"
                  >
                    Đóng kỳ
                  </button>
                )}
                {p.status === "closed" && (
                  <button
                    title="Hủy chốt"
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Hủy chốt kỳ đánh giá?",
                        message:
                          'Các phiếu đã chốt sẽ chuyển về trạng thái "Chờ Bí thư xã chốt" để sửa lại.',
                        details:
                          "Bạn sẽ cần chốt lại từng phiếu sau khi điều chỉnh xong.",
                        variant: "warning",
                        confirmText: "Hủy chốt",
                      });
                      if (!ok) return;
                      run(
                        `st-${p.id}`,
                        () => setEvaluationPeriodStatus(p.id, "open"),
                        "Đã hủy chốt, kỳ chuyển về đang đánh giá",
                      );
                    }}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg"
                  >
                    <Unlock className="w-3 h-3 inline mr-0.5" /> Hủy chốt
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ================= TAB: ĐOÀN VIÊN ================= */}
      {tab === "members" && (
        <div className="space-y-3">
          {/* Thống kê */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              {
                label: "Tổng phiếu",
                value: stats.total,
                color: "text-slate-800",
              },
              {
                label: "Xuất sắc",
                value: stats.excellent,
                color: "text-emerald-700",
              },
              { label: "Tốt", value: stats.good, color: "text-blue-700" },
              {
                label: "Hoàn thành",
                value: stats.pass,
                color: "text-amber-700",
              },
              {
                label: "Chưa chốt",
                value: stats.pending,
                color: "text-rose-700",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2.5"
              >
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Bộ lọc */}
          {!isMember && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên đoàn viên hoặc chi đoàn…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              {isAdmin && (
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="all">Tất cả chi đoàn</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value as any)}
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="all">Mọi mức xếp loại</option>
                {RATING_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {RATING_SHORT_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Danh sách */}
          {visibleMemberEvals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              {memberEvals.length === 0
                ? "Kỳ này chưa có phiếu đánh giá. Bí thư xã cần tạo phiếu trước."
                : "Không có phiếu nào khớp bộ lọc."}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">
                      Đoàn viên
                    </th>
                    <th className="text-left px-3 py-2 font-semibold">
                      Chi đoàn
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Nhiệm vụ
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Tỷ lệ
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Máy tính
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Bí thư CĐ
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Chốt
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Trạng thái
                    </th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMemberEvals.map((ev) => {
                    const m = memberById.get(ev.member_id);
                    const u = unitById.get(ev.unit_id);
                    const finalLevel =
                      ev.admin_rating || ev.secretary_rating || ev.auto_rating;
                    return (
                      <tr
                        key={ev.id}
                        className="border-t border-slate-100 hover:bg-slate-50/70"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {m?.avatar_url && (
                              <Avatar
                                src={m.avatar_url}
                                name={m?.full_name}
                                seed={m?.id}
                                size={24}
                              />
                            )}
                            <span className="font-semibold text-slate-800">
                              {m?.full_name || "—"}
                            </span>
                            {ev.is_party_member_block && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">
                                ĐV Đảng
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {u?.name || "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-700">
                          {ev.completed_tasks}/{ev.total_tasks}
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-slate-800">
                          {ev.participation_rate}%
                        </td>
                        <td className="px-3 py-2 text-center">
                          <RatingBadge level={ev.auto_rating} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {ev.secretary_rating ? (
                            <RatingBadge level={ev.secretary_rating} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {ev.admin_rating ? (
                            <RatingBadge level={ev.admin_rating} />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_BADGE[ev.status]}`}
                          >
                            {STATUS_LABEL[ev.status]}
                            {finalLevel && ev.status === "finalized" ? "" : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            title="Xem"
                            type="button"
                            onClick={() => openDetail(ev)}
                            className="text-[11px] font-semibold text-doan hover:underline"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Hàng đợi của bí thư chi đoàn */}
          {isSecretary && secretaryQueue.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
              <p className="font-bold flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4" />
                {secretaryQueue.length} phiếu đang chờ bạn duyệt trong chi đoàn.
              </p>
              <p className="text-[11px] mt-0.5">
                Bấm "Xem" ở từng dòng để xác nhận hoặc điều chỉnh mức xếp loại.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB: CHI ĐOÀN ================= */}
      {tab === "units" && !isMember && (
        <div className="space-y-3">
          {isAdmin && (
            <button
              title="Tạo / làm mới phiếu chi đoàn"
              type="button"
              disabled={!activePeriod || busy === "gen-units"}
              onClick={() =>
                activePeriod &&
                run(
                  "gen-units",
                  () => generateUnitEvaluations(activePeriod.id),
                  "Đã tạo phiếu chi đoàn",
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-doan hover:bg-doan-dark rounded-lg disabled:opacity-60"
            >
              {busy === "gen-units" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Tạo / làm mới phiếu chi đoàn
            </button>
          )}

          {unitEvals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Kỳ này chưa có phiếu chi đoàn.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">
                      Chi đoàn
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      % Nhiệm vụ
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      % ĐV tốt trở lên
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      % Hồ sơ số hoá
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Máy tính
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Chốt
                    </th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {unitEvals
                    .filter((e) => !isSecretary || e.unit_id === myUnitId)
                    .map((ev) => {
                      const u = unitById.get(ev.unit_id);
                      return (
                        <tr
                          key={ev.id}
                          className="border-t border-slate-100 hover:bg-slate-50/70"
                        >
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            {u?.name || "—"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ev.task_completion_rate}%
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ev.member_good_rate}%
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ev.digital_rate}%
                          </td>
                          <td className="px-3 py-2 text-center">
                            <RatingBadge level={ev.auto_rating} />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {ev.final_rating ? (
                              <RatingBadge level={ev.final_rating} />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              title="Mở phiếu đánh giá chi đoàn để chấm điểm"
                              onClick={() => openUnitDetail(ev)}
                              className="text-[11px] font-semibold text-doan hover:underline"
                            >
                              {isAdmin ? "Chấm điểm" : "Xem"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB: KỶ LUẬT ================= */}
      {tab === "discipline" && isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">
              Chỉ Bí thư xã ghi nhận. Kỷ luật từ <strong>cảnh cáo</strong> trở
              lên khiến đoàn viên bị xếp "Không hoàn thành nhiệm vụ".
            </p>
            <button
              title="Ghi nhận kỷ luật"
              type="button"
              onClick={() => {
                setDiscMemberId("");
                setDiscDecisionNo("");
                setDiscForm("reprimand");
                setDiscDecidedAt(new Date().toISOString().slice(0, 10));
                setDiscReason("");
                setDiscSearch("");
                setIsDiscModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> Ghi nhận kỷ luật
            </button>
          </div>

          {disciplines.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Chưa có bản ghi kỷ luật nào trong năm của kỳ đang chọn.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">
                      Đoàn viên
                    </th>
                    <th className="text-left px-3 py-2 font-semibold">
                      Số quyết định
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Hình thức
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Ngày quyết định
                    </th>
                    <th className="text-left px-3 py-2 font-semibold">Lý do</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {disciplines.map((d) => {
                    const m = memberById.get(d.member_id);
                    const strict = [
                      "warning",
                      "dismissal",
                      "expulsion",
                    ].includes(d.form);
                    return (
                      <tr key={d.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {m?.full_name || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {d.decision_no}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              strict
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }`}
                          >
                            {DISCIPLINE_LABELS[d.form]}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {fmtDate(d.decided_at)}
                        </td>
                        <td className="px-3 py-2 text-slate-600 max-w-[240px] truncate">
                          {d.reason || "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            title="Xóa"
                            type="button"
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Xóa bản ghi kỷ luật?",
                                message: `Bản ghi kỷ luật của ${m?.full_name || "đoàn viên này"} sẽ bị xóa vĩnh viễn.`,
                                details:
                                  "Sau khi xóa, kỷ luật này không còn ảnh hưởng đến kết quả xếp loại đã tính.",
                                variant: "danger",
                                confirmText: "Xóa vĩnh viễn",
                              });
                              if (!ok) return;
                              run(
                                `del-disc-${d.id}`,
                                () => deleteMemberDiscipline(d.id),
                                "Đã xóa bản ghi kỷ luật",
                              );
                            }}
                            className="text-rose-600 hover:text-rose-800"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ MODAL: TẠO KỲ ============ */}
      {isPeriodModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Tạo kỳ đánh giá
              </h3>
              <button
                title="Đóng"
                type="button"
                onClick={() => setIsPeriodModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Năm
                </label>
                <input
                  type="number"
                  value={formYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setFormYear(y);
                    setFormName(
                      formType === "school_year"
                        ? `Đánh giá, xếp loại năm học ${y}-${y + 1}`
                        : `Đánh giá, xếp loại năm ${y}`,
                    );
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Loại kỳ
                </label>
                <select
                  value={formType}
                  onChange={(e) => {
                    const t = e.target.value as "calendar" | "school_year";
                    setFormType(t);
                    setFormName(
                      t === "school_year"
                        ? `Đánh giá, xếp loại năm học ${formYear}-${formYear + 1}`
                        : `Đánh giá, xếp loại năm ${formYear}`,
                    );
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                >
                  <option value="calendar">
                    Năm dương lịch (01/01 → 31/12)
                  </option>
                  <option value="school_year">
                    Năm học (01/6 → 31/5 năm sau)
                  </option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Tên kỳ
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                title="Hủy"
                type="button"
                onClick={() => setIsPeriodModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                title="Lưu"
                type="button"
                disabled={busy === "save-period" || !formName.trim()}
                onClick={() =>
                  run(
                    "save-period",
                    () =>
                      saveEvaluationPeriod({
                        year: formYear,
                        periodType: formType,
                        name: formName.trim(),
                      }),
                    "Đã lưu kỳ đánh giá",
                  ).then(() => setIsPeriodModalOpen(false))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-doan hover:bg-doan-dark rounded-lg disabled:opacity-60"
              >
                {busy === "save-period" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL: CHI TIẾT PHIẾU ĐOÀN VIÊN ============ */}
      {detail &&
        (() => {
          const m = memberById.get(detail.member_id);
          const u = unitById.get(detail.unit_id);
          const rl = rldvByMember.get(detail.member_id);
          const discs = disByMember.get(detail.member_id) || [];
          const strict = activePeriod
            ? hasStrictDisciplineInPeriod(
                discs,
                activePeriod.start_date,
                activePeriod.end_date,
              )
            : false;

          // Tính nợ đoàn phí trong năm
          const paidMonths = new Set<number>();
          for (const p of feePayments) {
            if (p.member_id === detail.member_id && p.status === "approved") {
              for (const month of p.months || []) paidMonths.add(month);
            }
          }
          const exemptSet = new Set(m?.exempt_months || []);
          const unpaidMonths: number[] = [];
          const curM =
            activePeriod?.year === new Date().getFullYear()
              ? new Date().getMonth() + 1
              : 12;
          for (let i = 1; i <= curM; i++) {
            if (!paidMonths.has(i) && !exemptSet.has(i)) unpaidMonths.push(i);
          }
          const hasUnpaidFee = unpaidMonths.length > 0;

          const preview = computeMemberRating({
            totalTasks: detail.total_tasks,
            completedTasks: detail.completed_tasks,
            rldvLevel: rl?.level ?? null,
            hasStrictDiscipline: strict,
            isPartyMember: detail.is_party_member_block,
            isLongAbsent: detail.is_long_absent,
          });
          const canRespond =
            isMember &&
            detail.member_id === currentMember?.id &&
            detail.status !== "finalized";
          const canReview =
            (isSecretary || isAdmin) && detail.status !== "finalized";
          const canFinalize = isAdmin && detail.status !== "finalized";

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {m?.avatar_url && (
                      <Avatar
                        src={m.avatar_url}
                        name={m?.full_name}
                        seed={m?.id}
                        size={40}
                      />
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {m?.full_name}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {u?.name} · {activePeriod?.name}
                      </p>
                    </div>
                  </div>
                  <button
                    title="Đóng"
                    type="button"
                    onClick={() => setDetail(null)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Số liệu */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500">
                      Nhiệm vụ hoàn thành
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {detail.completed_tasks}/{detail.total_tasks}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500">Tỷ lệ tham gia</p>
                    <p className="text-sm font-bold text-slate-800">
                      {detail.participation_rate}%
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500">Mức máy tính</p>
                    <p className="mt-0.5">
                      <RatingBadge level={detail.auto_rating} />
                    </p>
                  </div>
                </div>

                {/* Giải thích công thức */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-[11px] text-blue-900 space-y-1">
                  {preview.reasons.map((r, i) => (
                    <p key={i}>• {r}</p>
                  ))}
                  {rl && (
                    <p>
                      • Mức Chương trình RLĐV năm {activePeriod?.year}:{" "}
                      <strong>{RATING_SHORT_LABELS[rl.level]}</strong>
                    </p>
                  )}
                  {strict && (
                    <p className="text-rose-700 font-semibold">
                      • Có kỷ luật từ cảnh cáo trở lên trong kỳ.
                    </p>
                  )}
                  {hasUnpaidFee && (
                    <p className="text-amber-800 font-bold bg-amber-100/70 p-1 rounded">
                      ⚠️ Đoàn viên còn nợ đoàn phí {unpaidMonths.length} tháng
                      (T{unpaidMonths.join(", T")}) — Bí thư cân nhắc trước khi
                      duyệt/chốt.
                    </p>
                  )}
                </div>

                {/* Phản hồi của đoàn viên */}
                {detail.member_response && (
                  <div
                    className={`rounded-lg p-2.5 text-[11px] border ${
                      detail.member_response === "confirmed"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    }`}
                  >
                    <p className="font-bold flex items-center gap-1">
                      <MessageSquareWarning className="w-3.5 h-3.5" />
                      Đoàn viên{" "}
                      {detail.member_response === "confirmed"
                        ? "đã xác nhận"
                        : "báo sai"}
                    </p>
                    {detail.member_feedback && (
                      <p className="mt-0.5">{detail.member_feedback}</p>
                    )}
                  </div>
                )}

                {/* Đoàn viên tự xác nhận */}
                {canRespond && (
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-800">
                      Xác nhận kết quả
                    </p>
                    {detail.member_response === "confirmed" ? (
                      <p className="text-[11px] text-emerald-700">
                        Bạn đã xác nhận kết quả này.
                      </p>
                    ) : (
                      <>
                        <textarea
                          value={memberFeedback}
                          onChange={(e) => setMemberFeedback(e.target.value)}
                          rows={2}
                          placeholder="Nếu báo sai, ghi rõ lý do (VD: em có tham gia nhiệm vụ ngày 12/3 nhưng chưa được duyệt)…"
                          className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                        />
                        <div className="flex gap-2">
                          <button
                            title="Tôi xác nhận đúng"
                            type="button"
                            disabled={busy === "resp"}
                            onClick={() =>
                              run(
                                "resp",
                                () =>
                                  saveMemberEvaluationResponse({
                                    evaluationId: detail.id,
                                    response: "confirmed",
                                  }),
                                "Đã xác nhận kết quả",
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
                          >
                            {busy === "resp" && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            <CheckCircle2 className="w-3 h-3" /> Tôi xác nhận
                            đúng
                          </button>
                          <button
                            title="Báo sai"
                            type="button"
                            disabled={busy === "resp" || !memberFeedback.trim()}
                            onClick={() =>
                              run(
                                "resp",
                                () =>
                                  saveMemberEvaluationResponse({
                                    evaluationId: detail.id,
                                    response: "disagreed",
                                    feedback: memberFeedback.trim(),
                                  }),
                                "Đã gửi báo sai tới bí thư chi đoàn",
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg disabled:opacity-50"
                          >
                            <AlertTriangle className="w-3 h-3" /> Báo sai
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Bí thư chi đoàn duyệt */}
                {canReview && (
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2">
                    <p className="text-[11px] font-bold text-slate-800">
                      Duyệt / điều chỉnh mức xếp loại
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={detailRating}
                        onChange={(e) =>
                          setDetailRating(e.target.value as RatingLevel)
                        }
                        className="flex-1 min-w-[200px] px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                      >
                        {RATING_ORDER.map((r) => (
                          <option key={r} value={r}>
                            {RATING_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={detailNote}
                        onChange={(e) => setDetailNote(e.target.value)}
                        placeholder="Ghi chú của bí thư (nếu có)"
                        className="flex-1 min-w-[200px] px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <button
                      title="Lưu quyết định của bí thư"
                      type="button"
                      disabled={busy === "review"}
                      onClick={() =>
                        run(
                          "review",
                          () =>
                            reviewMemberEvaluation({
                              evaluationId: detail.id,
                              rating: detailRating,
                              note: detailNote || undefined,
                            }),
                          "Đã duyệt kết quả",
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-doan hover:bg-doan-dark rounded-lg disabled:opacity-60"
                    >
                      {busy === "review" && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <Save className="w-3 h-3" /> Lưu quyết định của bí thư
                    </button>
                  </div>
                )}

                {/* Bí thư xã chốt */}
                {canFinalize && (
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/60">
                    <p className="text-[11px] font-bold text-slate-800">
                      Chốt kết quả (Bí thư xã)
                    </p>
                    <button
                      title="Chốt với mức đã chọn"
                      type="button"
                      disabled={busy === "finalize"}
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Chốt kết quả xếp loại?",
                          message:
                            "Sau khi chốt, phiếu bị KHÓA và không thể sửa trực tiếp.",
                          details:
                            'Muốn điều chỉnh phải vào tab "Kỳ đánh giá" bấm "Hủy chốt" cả kỳ, sửa rồi chốt lại.',
                          variant: "warning",
                          confirmText: "Chốt kết quả",
                        });
                        if (!ok) return;
                        run(
                          "finalize",
                          () =>
                            finalizeMemberEvaluation({
                              evaluationId: detail.id,
                              rating: detailRating,
                              note: detailNote || undefined,
                            }),
                          "Đã chốt kết quả",
                        );
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-60"
                    >
                      {busy === "finalize" && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      <Lock className="w-3 h-3" /> Chốt với mức đã chọn
                    </button>
                  </div>
                )}

                {/* Kết quả đã chốt */}
                {detail.status === "finalized" && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-900">
                    <p className="font-bold">
                      Kết quả đã chốt:{" "}
                      {RATING_LABELS[detail.admin_rating || "not_rated"]}
                    </p>
                    {detail.admin_note && (
                      <p className="mt-0.5">Ghi chú: {detail.admin_note}</p>
                    )}
                  </div>
                )}

                {/* RLĐV (bí thư xã / bí thư chi đoàn ghi) */}
                {(isAdmin || isSecretary) && (
                  <div className="border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] font-bold text-slate-800 mb-1.5">
                      Mức Chương trình Rèn luyện đoàn viên
                    </p>
                    <select
                      value={rl?.level || "not_rated"}
                      onChange={(e) => {
                        const lv = e.target.value as RatingLevel;
                        run(
                          `rldv-${detail.member_id}`,
                          () =>
                            saveMemberRldvLevel({
                              memberId: detail.member_id,
                              year: activePeriod!.year,
                              level: lv,
                            }),
                          "Đã lưu mức RLĐV",
                        );
                      }}
                      className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                    >
                      <option value="not_rated">Chưa ghi nhận</option>
                      <option value="excellent">Xuất sắc</option>
                      <option value="good">Tốt</option>
                      <option value="pass">Hoàn thành</option>
                      <option value="fail">Không hoàn thành</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* ============ MODAL: CHI TIẾT PHIẾU CHI ĐOÀN ============ */}
      {unitDetail &&
        (() => {
          const u = unitById.get(unitDetail.unit_id);
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {u?.name}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {activePeriod?.name}
                    </p>
                  </div>
                  <button
                    title="Đóng"
                    type="button"
                    onClick={() => setUnitDetail(null)}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500">% Nhiệm vụ</p>
                    <p className="text-sm font-bold text-slate-800">
                      {unitDetail.task_completion_rate}%
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500">
                      % ĐV tốt trở lên
                    </p>
                    <p className="text-sm font-bold text-slate-800">
                      {unitDetail.member_good_rate}%
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500">% Hồ sơ số hoá</p>
                    <p className="text-sm font-bold text-slate-800">
                      {unitDetail.digital_rate}%
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-[11px] text-blue-900">
                  <p>
                    Máy tính đề xuất:{" "}
                    <strong>
                      {RATING_SHORT_LABELS[unitDetail.auto_rating]}
                    </strong>
                  </p>
                  <p className="mt-0.5 text-[10px]">
                    Theo văn bản: 100% nhiệm vụ + ≥80% ĐV tốt trở lên + 100% hồ
                    sơ số hoá → Xuất sắc; 100% + ≥60% + ≥80% → Tốt; ≥70% + ≥50%
                    + ≥50% → Hoàn thành.
                  </p>
                </div>

                {isAdmin && unitDetail.status !== "finalized" && (
                  <div className="border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
                    <p className="text-[11px] font-bold text-slate-800">
                      Thông tin bí thư xã nhập
                    </p>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={unitMeetingOk}
                        onChange={(e) => setUnitMeetingOk(e.target.checked)}
                      />
                      Họp chi đoàn đầy đủ 1 tháng/lần
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={unitFeeOk}
                        onChange={(e) => setUnitFeeOk(e.target.checked)}
                      />
                      Thu, nộp đoàn phí đúng quy định
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={unitHasDiscipline}
                        onChange={(e) => setUnitHasDiscipline(e.target.checked)}
                      />
                      Có đoàn viên bị kỷ luật trong kỳ
                    </label>

                    <div className="pt-1.5 border-t border-slate-100 space-y-2">
                      <select
                        value={unitRating}
                        onChange={(e) =>
                          setUnitRating(e.target.value as RatingLevel)
                        }
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                      >
                        {RATING_ORDER.filter((r) => r !== "not_rated").map(
                          (r) => (
                            <option key={r} value={r}>
                              {RATING_LABELS[r]}
                            </option>
                          ),
                        )}
                      </select>
                      <input
                        value={unitNote}
                        onChange={(e) => setUnitNote(e.target.value)}
                        placeholder="Ghi chú (nếu có)"
                        className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg"
                      />
                      <button
                        title="Chốt kết quả chi đoàn"
                        type="button"
                        disabled={busy === "finalize-unit"}
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Chốt kết quả chi đoàn?",
                            message:
                              "Phiếu đánh giá chi đoàn sẽ bị khóa sau khi chốt.",
                            details:
                              "Muốn sửa phải hủy chốt cả kỳ đánh giá rồi thực hiện lại.",
                            variant: "warning",
                            confirmText: "Chốt kết quả",
                          });
                          if (!ok) return;
                          run(
                            "finalize-unit",
                            () =>
                              finalizeUnitEvaluation({
                                unitEvaluationId: unitDetail.id,
                                rating: unitRating,
                                meetingOk: unitMeetingOk,
                                feeOk: unitFeeOk,
                                hasDiscipline: unitHasDiscipline,
                                note: unitNote || undefined,
                              }),
                            "Đã chốt kết quả chi đoàn",
                          );
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg disabled:opacity-60"
                      >
                        {busy === "finalize-unit" && (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        )}
                        <Lock className="w-3 h-3" /> Chốt kết quả chi đoàn
                      </button>
                    </div>
                  </div>
                )}

                {unitDetail.status === "finalized" && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-[11px] text-emerald-900">
                    <p className="font-bold">
                      Đã chốt:{" "}
                      {RATING_LABELS[unitDetail.final_rating || "not_rated"]}
                    </p>
                    {unitDetail.note && (
                      <p className="mt-0.5">Ghi chú: {unitDetail.note}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* ============ MODAL: GHI NHẬN KỶ LUẬT ============ */}
      {isDiscModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Ghi nhận kỷ luật đoàn viên
              </h3>
              <button
                title="Đóng"
                type="button"
                onClick={() => setIsDiscModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Đoàn viên
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={discSearch}
                    onChange={(e) => setDiscSearch(e.target.value)}
                    placeholder="Tìm theo tên…"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="mt-1 max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {discCandidates.map((m) => (
                    <button
                      title="·"
                      key={m.id}
                      type="button"
                      onClick={() => setDiscMemberId(m.id)}
                      className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 ${
                        discMemberId === m.id
                          ? "bg-blue-50 text-doan font-semibold"
                          : "text-slate-700"
                      }`}
                    >
                      {m.full_name}
                      <span className="text-[10px] text-slate-400 ml-1">
                        · {unitById.get(m.unit_id)?.name}
                      </span>
                    </button>
                  ))}
                  {discCandidates.length === 0 && (
                    <p className="px-2.5 py-2 text-[11px] text-slate-400">
                      Không tìm thấy đoàn viên.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Số quyết định
                  </label>
                  <input
                    value={discDecisionNo}
                    onChange={(e) => setDiscDecisionNo(e.target.value)}
                    placeholder="VD: 12-QĐ/ĐTN"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Hình thức
                  </label>
                  <select
                    value={discForm}
                    onChange={(e) =>
                      setDiscForm(e.target.value as DisciplineForm)
                    }
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                  >
                    {(Object.keys(DISCIPLINE_LABELS) as DisciplineForm[]).map(
                      (f) => (
                        <option key={f} value={f}>
                          {DISCIPLINE_LABELS[f]}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Ngày quyết định
                </label>
                <input
                  type="date"
                  value={discDecidedAt}
                  onChange={(e) => setDiscDecidedAt(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 block mb-1">
                  Lý do
                </label>
                <textarea
                  value={discReason}
                  onChange={(e) => setDiscReason(e.target.value)}
                  rows={2}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {["warning", "dismissal", "expulsion"].includes(discForm) && (
                <p className="text-[11px] bg-rose-50 border border-rose-200 rounded-lg p-2 text-rose-800">
                  Hình thức này khiến đoàn viên bị xếp{" "}
                  <strong>Không hoàn thành nhiệm vụ</strong> trong kỳ có quyết
                  định.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                title="Hủy"
                type="button"
                onClick={() => setIsDiscModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                title="Lưu"
                type="button"
                disabled={
                  busy === "save-disc" ||
                  !discMemberId ||
                  !discDecisionNo.trim()
                }
                onClick={() =>
                  run(
                    "save-disc",
                    () =>
                      saveMemberDiscipline({
                        memberId: discMemberId,
                        decisionNo: discDecisionNo.trim(),
                        form: discForm,
                        decidedAt: discDecidedAt,
                        reason: discReason || undefined,
                      }),
                    "Đã ghi nhận kỷ luật",
                  ).then(() => setIsDiscModalOpen(false))
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60"
              >
                {busy === "save-disc" && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
