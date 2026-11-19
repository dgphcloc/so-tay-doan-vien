import React, { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import { useConfirm } from "../common/ConfirmDialog";
import { Avatar } from "../common/Avatar";
import { formatDateVN, formatDateTimeVN } from "../../mock/data";
import type { Evidence, ReviewStatus } from "../../types";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  FileText,
  Link2,
  Maximize2,
  X,
  BadgeCheck,
  MapPin,
  ChevronLeft,
} from "lucide-react";

type FilterKey = "all" | "pending" | "approved" | "rejected" | "missing";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
  { key: "missing", label: "Chưa nộp" },
];

/**
 * Tab "Báo cáo chi đoàn" trong chi tiết nhiệm vụ — dành cho Bí thư Đoàn xã / admin.
 *
 * Mỗi chi đoàn được giao nhiệm vụ có đúng MỘT báo cáo của bí thư (bảng unit_reports).
 * Đây là báo cáo riêng về công tác chỉ đạo, KHÁC với kết quả nhiệm vụ của chi đoàn
 * (bảng task_results, xem ở tab "Kết quả & Minh chứng").
 */
export const UnitReportsPanel: React.FC<{ taskId: string }> = ({ taskId }) => {
  const {
    units,
    taskUnits,
    listUnitReports,
    listUnitReportEvidences,
    reviewUnitReport,
    showToast,
    getUnitById,
    getMemberById,
  } = useApp();
  const { confirm, prompt } = useConfirm();

  const [rows, setRows] = useState<Awaited<ReturnType<typeof listUnitReports>>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loadingEv, setLoadingEv] = useState(false);
  const [lightbox, setLightbox] = useState<Evidence | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      setRows(await listUnitReports({ taskId }));
    } catch (e) {
      showToast({
        title: "Không tải được báo cáo",
        description: e instanceof Error ? e.message : "",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload(); /* eslint-disable-next-line */
  }, [taskId]);

  // Chi đoàn được giao nhiệm vụ này
  const assignedUnitIds = useMemo(
    () =>
      taskUnits.filter((tu) => tu.task_id === taskId).map((tu) => tu.unit_id),
    [taskUnits, taskId],
  );

  /** Ghép mỗi chi đoàn được giao với báo cáo (nếu có). */
  const merged = useMemo(() => {
    const byUnit = new Map(rows.map((r) => [r.unit_id, r]));
    return assignedUnitIds.map((uid) => ({
      unitId: uid,
      unit: units.find((u) => u.id === uid) ?? null,
      report: byUnit.get(uid) ?? null,
    }));
  }, [assignedUnitIds, rows, units]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merged.filter((m) => {
      const status = m.report?.status ?? "missing";
      if (filter !== "all" && status !== filter) return false;
      if (q && !(m.unit?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [merged, filter, search]);

  const counts = useMemo(
    () => ({
      all: merged.length,
      pending: merged.filter((m) => m.report?.status === "pending").length,
      approved: merged.filter((m) => m.report?.status === "approved").length,
      rejected: merged.filter((m) => m.report?.status === "rejected").length,
      missing: merged.filter((m) => !m.report).length,
    }),
    [merged],
  );

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  // Nạp minh chứng khi mở chi tiết
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedId) {
        setEvidences([]);
        return;
      }
      setLoadingEv(true);
      try {
        const evs = await listUnitReportEvidences(selectedId);
        if (!cancelled) setEvidences(evs);
      } catch {
        if (!cancelled) setEvidences([]);
      } finally {
        if (!cancelled) setLoadingEv(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId, listUnitReportEvidences]);

  const handleApprove = async (id: string) => {
    const ok = await confirm({
      title: "Duyệt báo cáo này?",
      message:
        'Báo cáo sẽ chuyển sang trạng thái "Đã duyệt". Bí thư chi đoàn không sửa được nữa.',
      variant: "success",
      confirmText: "Duyệt",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await reviewUnitReport(id, true);
      if (res.success) {
        showToast({ title: "Đã duyệt báo cáo", type: "success" });
        setSelectedId(null);
        await reload();
      } else {
        showToast({
          title: "Không duyệt được",
          description: res.message,
          type: "error",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (id: string) => {
    const note = await prompt({
      title: "Từ chối báo cáo",
      message: "Nêu lý do để bí thư chi đoàn biết cần sửa gì.",
      placeholder: "VD: Thiếu số liệu minh chứng cho hoạt động tháng 11...",
      required: true,
      variant: "danger",
      confirmText: "Từ chối",
    });
    if (!note) return;
    setBusy(true);
    try {
      const res = await reviewUnitReport(id, false, note);
      if (res.success) {
        showToast({ title: "Đã từ chối báo cáo", type: "success" });
        setSelectedId(null);
        await reload();
      } else {
        showToast({
          title: "Không từ chối được",
          description: res.message,
          type: "error",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  /** Nhãn trạng thái trên danh sách. */
  const statusBadge = (status: ReviewStatus | "missing") => {
    if (status === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="w-3 h-3" /> Đã duyệt
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
          <Clock className="w-3 h-3" /> Chờ duyệt
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
          <XCircle className="w-3 h-3" /> Từ chối
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
        Chưa nộp
      </span>
    );
  };

  return (
    <div className="space-y-3 text-xs">
      {/* Thanh công cụ */}
      <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-slate-200">
        <div className="relative flex-1 min-w-[10rem]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên chi đoàn…"
            className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-doan"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            title={`Lọc: ${f.label} (${counts[f.key]} chi đoàn)`}
            className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
              filter === f.key
                ? "bg-doan text-white border-doan"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
        <button
          type="button"
          onClick={reload}
          title="Tải lại danh sách báo cáo"
          className="p-1.5 text-slate-500 hover:text-doan bg-white border border-slate-300 rounded-lg"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Danh sách */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          {merged.length === 0
            ? "Nhiệm vụ này chưa được giao cho chi đoàn nào."
            : "Không có chi đoàn nào khớp bộ lọc hiện tại."}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {filtered.map(({ unit, report }) => {
            const submitter = report
              ? getMemberById(report.submitted_by)
              : null;
            return (
              <div
                key={unit?.id ?? "unknown"}
                className={`p-3 flex items-center justify-between gap-3 ${
                  report ? "hover:bg-blue-50/40 cursor-pointer" : ""
                }`}
                onClick={() => {
                  if (report) setSelectedId(report.id);
                }}
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  {submitter && (
                    <Avatar
                      name={submitter.full_name}
                      seed={submitter.id}
                      size={28}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {unit?.name ?? "Chi đoàn"}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {report
                        ? `Người nộp: ${submitter?.full_name ?? "—"} • ${formatDateVN(report.submitted_at)}`
                        : "Bí thư chưa nộp báo cáo"}
                    </p>
                    {report?.review_note && (
                      <p className="text-[11px] text-slate-600 mt-0.5 italic line-clamp-1">
                        Nhận xét: {report.review_note}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge(report?.status ?? "missing")}
                  {report && (
                    <button
                      type="button"
                      title="Xem chi tiết báo cáo và duyệt"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(report.id);
                      }}
                      className="px-2.5 py-1 font-semibold text-doan bg-blue-50 hover:bg-blue-100 rounded-lg"
                    >
                      Xem
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chi tiết báo cáo */}
      {selected && (
        <div className="fixed inset-0 z-[160] w-screen h-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 text-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  title="Quay lại danh sách báo cáo"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 mb-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Danh sách
                </button>
                <h3 className="text-sm font-bold text-slate-900">
                  Báo cáo: {getUnitById(selected.unit_id)?.name ?? "Chi đoàn"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Người nộp:{" "}
                  {getMemberById(selected.submitted_by)?.full_name ?? "—"}
                  {" • "}
                  {formatDateTimeVN(selected.submitted_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Đóng chi tiết"
                className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex items-center gap-2">
                {statusBadge(selected.status)}
                {selected.reviewed_at && (
                  <span className="text-[11px] text-slate-500">
                    Duyệt lúc {formatDateTimeVN(selected.reviewed_at)}
                    {selected.reviewed_by
                      ? ` bởi ${getMemberById(selected.reviewed_by)?.full_name ?? ""}`
                      : ""}
                  </span>
                )}
              </div>

              {selected.review_note && (
                <div
                  className={`p-3 rounded-xl border ${
                    selected.status === "rejected"
                      ? "bg-rose-50 border-rose-200 text-rose-800"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  <p className="font-bold">Nhận xét của người duyệt</p>
                  <p className="mt-0.5">{selected.review_note}</p>
                </div>
              )}

              <div>
                <p className="font-bold text-slate-800 mb-1">
                  Nội dung báo cáo
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 whitespace-pre-line">
                  {selected.note || (
                    <span className="text-slate-400 italic">
                      Không có nội dung
                    </span>
                  )}
                </div>
              </div>

              {loadingEv ? (
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang nạp minh
                  chứng…
                </p>
              ) : evidences.length === 0 ? (
                <p className="text-[11px] text-slate-400">
                  Không có minh chứng đính kèm.
                </p>
              ) : (
                <div className="space-y-3">
                  {evidences.filter((e) => e.evidence_type === "photo").length >
                    0 && (
                    <div>
                      <p className="font-bold text-slate-800 mb-1.5">
                        Ảnh minh chứng
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {evidences
                          .filter((e) => e.evidence_type === "photo")
                          .map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => setLightbox(ev)}
                              title="Xem ảnh cỡ lớn"
                              className="relative border border-slate-200 rounded-lg overflow-hidden bg-white group"
                            >
                              <img
                                src={ev.url}
                                alt={ev.file_name}
                                className="w-full h-24 object-cover"
                              />
                              <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 flex items-center justify-center transition-colors">
                                <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                              </span>
                              {ev.lat !== null && ev.lng !== null && (
                                <span className="absolute bottom-1 left-1 bg-emerald-600/90 text-white text-[9px] px-1 rounded flex items-center gap-0.5">
                                  <MapPin className="w-2 h-2" /> GPS
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {evidences.filter((e) => e.evidence_type === "file").length >
                    0 && (
                    <div>
                      <p className="font-bold text-slate-800 mb-1.5">
                        Tệp đính kèm
                      </p>
                      <div className="space-y-1">
                        {evidences
                          .filter((e) => e.evidence_type === "file")
                          .map((ev) => (
                            <a
                              key={ev.id}
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Mở tệp trong tab mới"
                              className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.file_name}</span>
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {evidences.filter((e) => e.evidence_type === "link").length >
                    0 && (
                    <div>
                      <p className="font-bold text-slate-800 mb-1.5">
                        Đường link
                      </p>
                      <div className="space-y-1">
                        {evidences
                          .filter((e) => e.evidence_type === "link")
                          .map((ev) => (
                            <a
                              key={ev.id}
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Mở link trong tab mới"
                              className="flex items-center gap-1.5 px-2 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-doan"
                            >
                              <Link2 className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{ev.url}</span>
                            </a>
                          ))}
                      </div>
                    </div>
                  )}

                  {evidences.filter((e) => e.evidence_type === "list").length >
                    0 && (
                    <div>
                      <p className="font-bold text-slate-800 mb-1.5">Ghi chú</p>
                      {evidences
                        .filter((e) => e.evidence_type === "list")
                        .map((ev) => (
                          <div
                            key={ev.id}
                            className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 whitespace-pre-line"
                          >
                            {ev.file_name}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                title="Đóng, không thay đổi"
                className="px-3 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Đóng
              </button>
              {selected.status !== "approved" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleReject(selected.id)}
                    title="Từ chối và yêu cầu bí thư chi đoàn sửa lại"
                    className="inline-flex items-center gap-1.5 px-3 py-2 font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg disabled:opacity-60"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleApprove(selected.id)}
                    title="Duyệt báo cáo này"
                    className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <BadgeCheck className="w-3.5 h-3.5" />
                    )}
                    Duyệt
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox ảnh */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[170] w-screen h-screen flex items-center justify-center bg-slate-900/90 p-6"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox.url}
            alt={lightbox.file_name}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            title="Đóng ảnh"
            className="absolute top-4 right-4 p-2 text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
