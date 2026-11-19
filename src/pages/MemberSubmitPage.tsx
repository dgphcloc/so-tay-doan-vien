import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QrScanModal } from "../components/tasks/QrScanModal";
import { UnitKpiBoard } from "../components/criteria/UnitKpiBoard";
import { useApp } from "../context/AppContext";
import {
  sha256Hex,
  sha256HexOfString,
  getGpsPosition,
  pickImageFile,
  pickAnyFile,
  captureFromCamera,
} from "../utils/evidence";
import type { EvidenceInput } from "../data/repository";
import { formatDateVN, formatDateTimeVN } from "../mock/data";
import { parseMapLink, haversineMeters } from "../utils/geo";
import {
  Camera,
  ScanLine,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ClipboardList,
  ImagePlus,
  X,
  RefreshCw,
  FileText,
  Link2,
  StickyNote,
  FileUp,
  Upload,
  ArrowLeft,
  BadgeCheck,
} from "lucide-react";

/** Minh chứng đã sẵn sàng gửi kèm (đã upload / đã băm). */
interface ReadyEvidence extends EvidenceInput {
  label: string;
}

/**
 * Trang đoàn viên nộp minh chứng CÁ NHÂN cho một nhiệm vụ (mở từ QR / link / bảng tin).
 * Ảnh bắt buộc có toạ độ GPS (theo cấu hình năm), có ô nhập toạ độ tay khi trình duyệt chặn định vị.
 */
export const MemberSubmitPage: React.FC = () => {
  const {
    currentUser,
    currentMember,
    currentRole,
    yearlySettings,
    unitCommittees,
    subCriteria,
    tasks,
    taskResults,
    listMyFeed,
    uploadEvidence,
    submitMemberResult,
    listMemberSubmissionEvidences,
    showToast,
    getUnitCriterionProgress,
  } = useApp();

  const [searchParams] = useSearchParams();
  const taskParam = searchParams.get("task");

  const unitId = currentMember?.unit_id ?? null;
  const maxPhotos = yearlySettings.max_photos ?? 3;
  const maxFiles = yearlySettings.max_files ?? 3;
  const maxLinks = yearlySettings.max_links ?? 5;

  const [loading, setLoading] = useState(true);

  // KPI Đoàn xã giao cho chi đoàn — hiện cho bí thư / phó bí thư.
  // Nhận diện theo CẢ HAI nguồn để không bị lệch khi profile.role_id chưa cập nhật:
  //   (1) quyền tài khoản = unit_secretary
  //   (2) chức vụ trong hồ sơ đoàn viên = Bí thư / Phó Bí thư
  const isSecretary = (() => {
    if (currentRole === "unit_secretary") return true;
    if (
      currentMember?.current_position === "secretary" ||
      currentMember?.current_position === "deputy_secretary"
    )
      return true;
    // Nguồn thứ 3: có tên trong Ban Chấp hành đang giữ chức Bí thư / Phó Bí thư của chi đoàn
    if (!currentMember) return false;
    return unitCommittees.some(
      (c) =>
        String(c.member_id) === String(currentMember.id) &&
        !c.term_end &&
        (c.position === "secretary" || c.position === "deputy_secretary"),
    );
  })();
  const [kpis, setKpis] = useState<
    Array<{
      subCriterionId: string;
      criterionName: string;
      subName: string;
      maxScore: number;
      totalTasks: number;
      doneTasks: number;
      pendingTasks: number;
    }>
  >([]);
  const [feed, setFeed] = useState<Awaited<
    ReturnType<typeof listMyFeed>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<ReadyEvidence[]>([]);
  const [files, setFiles] = useState<ReadyEvidence[]>([]);
  const [linksText, setLinksText] = useState("");
  const [noteEvidence, setNoteEvidence] = useState("");
  // Toạ độ nhập tay (dùng khi trình duyệt chặn định vị)
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [mapLink, setMapLink] = useState("");

  const reload = async () => {
    setLoading(true);
    try {
      setFeed(await listMyFeed());
      if (isSecretary && unitId) {
        setKpis(await getUnitCriterionProgress(unitId));
      } else {
        setKpis([]);
      }
    } catch (e) {
      showToast({
        title: "Không tải được danh sách nhiệm vụ",
        description: e instanceof Error ? e.message : "",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Nạp lại khi context đã sẵn dữ liệu (subCriteria/tasks/taskResults đến bất đồng bộ)
  // hoặc khi đổi chi đoàn / quyền.
  useEffect(() => {
    reload();
    /* eslint-disable-next-line */
  }, [
    unitId,
    isSecretary,
    subCriteria.length,
    tasks.length,
    taskResults.length,
  ]);

  const activeItem = useMemo(
    () => feed?.find((f) => f.task.id === taskParam) ?? null,
    [feed, taskParam],
  );
  const activeTask = activeItem?.task ?? null;
  const mySubmission = activeItem?.mySubmission ?? null;

  // Nộp lại: nạp minh chứng cũ để người dùng thấy đã gửi gì
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!mySubmission) {
        setPhotos([]);
        setFiles([]);
        setNoteEvidence("");
        return;
      }
      setNote(mySubmission.note ?? "");
      if (mySubmission.lat !== null) setManualLat(String(mySubmission.lat));
      if (mySubmission.lng !== null) setManualLng(String(mySubmission.lng));
      try {
        const evs = await listMemberSubmissionEvidences(mySubmission.id);
        if (cancelled) return;
        setPhotos(
          evs
            .filter((e) => e.evidence_type === "photo")
            .map((e) => ({
              evidenceType: "photo",
              url: e.url,
              storagePath: e.storage_path,
              fileName: e.file_name,
              fileHash: e.file_hash,
              lat: e.lat,
              lng: e.lng,
              source: e.source,
              label: e.file_name || "Ảnh",
            })),
        );
        setFiles(
          evs
            .filter((e) => e.evidence_type === "file")
            .map((e) => ({
              evidenceType: "file",
              url: e.url,
              storagePath: e.storage_path,
              fileName: e.file_name,
              fileHash: e.file_hash,
              lat: e.lat,
              lng: e.lng,
              source: e.source,
              label: e.file_name || "Tệp",
            })),
        );
        setLinksText(
          evs
            .filter((e) => e.evidence_type === "link")
            .map((e) => e.url)
            .join(", "),
        );
        setNoteEvidence(
          evs
            .filter((e) => e.evidence_type === "list")
            .map((e) => e.file_name)
            .join(" • "),
        );
      } catch {
        // Minh chứng cũ không đọc được thì bỏ qua, người dùng vẫn nộp được bộ mới
      }
    })();
    return () => {
      cancelled = true;
    };
    /* eslint-disable-next-line */
  }, [mySubmission?.id]);

  /** Dán link Google Maps -> tự điền vào ô vĩ độ / kinh độ. */
  const handlePasteMapLink = (value: string) => {
    setMapLink(value);
    const coords = parseMapLink(value);
    if (coords) {
      setManualLat(String(coords.lat));
      setManualLng(String(coords.lng));
    }
  };

  /** Toạ độ nhập tay (nếu có) để gán cho ảnh thiếu GPS. */
  const manualCoords = (): { lat: number | null; lng: number | null } => {
    const lat = Number(manualLat),
      lng = Number(manualLng);
    const okLat =
      manualLat.trim() !== "" &&
      Number.isFinite(lat) &&
      lat >= -90 &&
      lat <= 90;
    const okLng =
      manualLng.trim() !== "" &&
      Number.isFinite(lng) &&
      lng >= -180 &&
      lng <= 180;
    return okLat && okLng ? { lat, lng } : { lat: null, lng: null };
  };

  const addPhoto = async (source: "camera" | "upload") => {
    if (!unitId) return;
    if (photos.length >= maxPhotos) {
      showToast({
        title: `Tối đa ${maxPhotos} ảnh`,
        description: "Vào Cấu hình để tăng giới hạn.",
        type: "error",
      });
      return;
    }
    try {
      const file =
        source === "camera" ? await captureFromCamera() : await pickImageFile();
      if (!file) return;
      setBusy(true);
      let lat: number | null = null,
        lng: number | null = null;
      let accuracy: number | null = null;
      // 'gps' = lấy từ thiết bị; 'manual' = nhập tay; 'link' = dán Google Maps.
      // Cán bộ thấy nhãn "Không xác thực" khi nguồn khác 'gps'.
      let coordSource: "gps" | "manual" | "link" | null = null;
      try {
        const pos = await getGpsPosition();
        lat = pos.lat;
        lng = pos.lng;
        accuracy = pos.accuracy ?? null;
        coordSource = "gps";
      } catch (e) {
        // Trình duyệt chặn định vị: dùng toạ độ nhập tay nếu người dùng đã điền
        const manual = manualCoords();
        lat = manual.lat;
        lng = manual.lng;
        if (lat !== null) {
          // Nếu toạ độ đến từ ô dán link thì ghi đúng nguồn 'link'
          coordSource =
            mapLink.trim() && parseMapLink(mapLink) ? "link" : "manual";
        } else {
          showToast({
            title: "Không lấy được GPS",
            description: `${e instanceof Error ? e.message : ""} Bạn có thể nhập toạ độ bằng tay ở ô bên dưới.`,
            type: "info",
          });
        }
      }
      const [hash, up] = await Promise.all([
        sha256Hex(file),
        uploadEvidence(file, unitId),
      ]);
      setPhotos((prev) => [
        ...prev,
        {
          evidenceType: "photo",
          url: up.url,
          storagePath: up.storagePath,
          fileName: file.name,
          fileHash: hash,
          lat,
          lng,
          source,
          label: file.name,
          accuracyM: accuracy,
          coordSource,
        },
      ]);
      showToast({ title: "Đã thêm ảnh minh chứng", type: "success" });
    } catch (e) {
      showToast({
        title: "Không thêm được ảnh",
        description: e instanceof Error ? e.message : "",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const addFile = async () => {
    if (!unitId) return;
    if (files.length >= maxFiles) {
      showToast({
        title: `Tối đa ${maxFiles} tệp`,
        description: "Vào Cấu hình để tăng giới hạn.",
        type: "error",
      });
      return;
    }
    try {
      const file = await pickAnyFile();
      if (!file) return;
      setBusy(true);
      const [hash, up] = await Promise.all([
        sha256Hex(file),
        uploadEvidence(file, unitId),
      ]);
      setFiles((prev) => [
        ...prev,
        {
          evidenceType: "file",
          url: up.url,
          storagePath: up.storagePath,
          fileName: file.name,
          fileHash: hash,
          lat: null,
          lng: null,
          source: "upload",
          label: file.name,
        },
      ]);
      showToast({ title: "Đã thêm tệp minh chứng", type: "success" });
    } catch (e) {
      showToast({
        title: "Không thêm được tệp",
        description: e instanceof Error ? e.message : "",
        type: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  /** Gán toạ độ nhập tay cho các ảnh còn thiếu GPS. */
  const applyManualToPhotos = () => {
    const { lat, lng } = manualCoords();
    if (lat === null || lng === null) {
      showToast({
        title: "Toạ độ chưa hợp lệ",
        description: "Nhập vĩ độ (-90..90) và kinh độ (-180..180).",
        type: "error",
      });
      return;
    }
    const src: "manual" | "link" =
      mapLink.trim() && parseMapLink(mapLink) ? "link" : "manual";
    setPhotos((prev) =>
      prev.map((p) =>
        p.lat === null || p.lng === null
          ? { ...p, lat, lng, coordSource: src }
          : p,
      ),
    );
    showToast({ title: "Đã gán toạ độ cho ảnh thiếu GPS", type: "success" });
  };

  const buildEvidences = async (): Promise<EvidenceInput[]> => {
    const list: EvidenceInput[] = [...photos, ...files];
    const links = linksText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, maxLinks);
    for (const url of links) {
      const hash = await sha256HexOfString(url);
      list.push({
        evidenceType: "link",
        url,
        storagePath: "",
        fileName: url,
        fileHash: hash,
        lat: null,
        lng: null,
        source: "upload",
      });
    }
    if (noteEvidence.trim()) {
      const text = noteEvidence.trim();
      const hash = await sha256HexOfString(text);
      list.push({
        evidenceType: "list",
        url: "",
        storagePath: "",
        fileName: text,
        fileHash: hash,
        lat: null,
        lng: null,
        source: "upload",
      });
    }
    return list;
  };

  const handleSubmit = async () => {
    if (!unitId || !activeTask) return;
    if (
      yearlySettings.require_gps &&
      photos.some((p) => p.lat === null || p.lng === null)
    ) {
      showToast({
        title: "Thiếu toạ độ GPS",
        description:
          'Ảnh minh chứng bắt buộc có toạ độ GPS. Bật quyền vị trí, hoặc nhập toạ độ bằng tay rồi bấm "Gán toạ độ".',
        type: "error",
      });
      return;
    }
    setBusy(true);
    try {
      const evidences = await buildEvidences();
      const coords = manualCoords();
      const res = await submitMemberResult({
        taskId: activeTask.id,
        note: note.trim() || undefined,
        lat: coords.lat,
        lng: coords.lng,
        evidences,
      });
      if (res.success) {
        showToast({
          title: "Đã gửi bài nộp",
          description: "Chờ bí thư chi đoàn xác nhận.",
          type: "success",
        });
        await reload();
      } else {
        showToast({
          title: "Không nộp được",
          description: res.message,
          type: "error",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-slate-500">
        Vui lòng đăng nhập để nộp minh chứng.
      </div>
    );
  }
  if (!currentMember?.unit_id) {
    return (
      <div className="p-8 text-center text-slate-500">
        Tài khoản chưa gắn với chi đoàn nào. Liên hệ cán bộ Đoàn xã để được gắn
        hồ sơ đoàn viên.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      </div>
    );
  }

  const linkCount = linksText
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;

  /**
   * Bán kính áp dụng: ưu tiên bán kính riêng của nhiệm vụ, không có thì dùng
   * cấu hình năm. Khớp đúng logic trigger `private.calc_checkin` trong database.
   */
  const appliedRadius =
    activeTask?.radius_m ?? yearlySettings.default_radius_m ?? 100;

  /**
   * Khoảng cách NHÁP tính ở trình duyệt — chỉ để nhắc đoàn viên trước khi nộp.
   * Kết quả CHÍNH THỨC do trigger trong database tính lại, giá trị này không gửi lên.
   * Lấy ảnh gần điểm tổ chức nhất trong số ảnh đã có GPS.
   */
  const draftDistance: number | null = (() => {
    if (!activeTask || activeTask.lat === null || activeTask.lng === null)
      return null;
    const withGps = photos.filter((p) => p.lat !== null && p.lng !== null);
    if (withGps.length === 0) return null;
    const dists = withGps.map((p) =>
      haversineMeters(
        { lat: activeTask.lat as number, lng: activeTask.lng as number },
        { lat: p.lat as number, lng: p.lng as number },
      ),
    );
    return Math.min(...dists);
  })();
  const locked = mySubmission?.status === "approved";

  // Chưa chọn nhiệm vụ: liệt kê để đoàn viên chọn
  if (!taskParam) {
    return (
      <>
        <div className="space-y-6">
          <div className="pb-3 border-b border-slate-200">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Upload className="w-6 h-6 text-doan" />
              Nộp minh chứng cá nhân
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-0.5">
              Chọn nhiệm vụ để nộp minh chứng (ảnh + GPS, tệp, link, ghi chú).
              Bạn cũng có thể mở từ link/QR do bí thư gửi.
            </p>
            <button
              title="Quét QR nhiệm vụ"
              type="button"
              onClick={() => setScanOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-doan hover:bg-[#1a4fa0] rounded-lg"
            >
              <ScanLine className="w-4 h-4" /> Quét QR nhiệm vụ
            </button>
          </div>

          {/* ===== KPI ĐOÀN XÃ GIAO CHO CHI ĐOÀN (chỉ bí thư / phó bí thư) ===== */}
          {isSecretary && (
            <UnitKpiBoard
              kpis={kpis}
              unitId={unitId ?? ""}
              onCreated={reload}
            />
          )}

          {/* ===== NHIỆM VỤ CẦN NỘP ===== */}
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">
              {isSecretary ? "Nhiệm vụ chi đoàn cần nộp" : "Nhiệm vụ cần nộp"}
            </h2>
          </div>

          {!feed || feed.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Chưa có nhiệm vụ nào cần nộp.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {feed.map(({ task, mySubmission: sub }) => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col gap-2"
                >
                  <h3 className="text-sm font-bold text-slate-900">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {task.content}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span>Hạn: {formatDateVN(task.due_date)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                      {task.submit_scope === "open"
                        ? "Ai cũng tham gia"
                        : "Theo chi đoàn được giao"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    {!sub ? (
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        Chưa nộp
                      </span>
                    ) : sub.status === "approved" ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3" /> Đã duyệt
                      </span>
                    ) : sub.status === "rejected" ? (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                        Bị từ chối
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                        Chờ duyệt
                      </span>
                    )}
                    <Link
                      to={`/nop-ca-nhan?task=${task.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-doan text-white hover:bg-[#1a4fa0]"
                    >
                      <Upload className="w-3.5 h-3.5" />{" "}
                      {sub ? "Xem / nộp lại" : "Nộp"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {scanOpen && <QrScanModal onClose={() => setScanOpen(false)} />}
      </>
    );
  }

  if (!activeTask) {
    return (
      <div className="p-10 text-center text-slate-500 space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
        <p className="text-sm">
          Không tìm thấy nhiệm vụ này trong danh sách của bạn. Nhiệm vụ có thể
          đã đóng, hoặc chỉ dành cho đoàn viên chi đoàn được giao.
        </p>
        <Link
          to="/nop-ca-nhan"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-doan"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Về danh sách nhiệm vụ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200 flex items-start justify-between gap-3">
        <div>
          <Link
            to="/nop-ca-nhan"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-3 h-3" /> Danh sách nhiệm vụ
          </Link>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 flex items-center gap-2.5 mt-1">
            <Upload className="w-5 h-5 text-doan" />
            {activeTask.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hạn: {formatDateVN(activeTask.due_date)} •{" "}
            {activeTask.submit_scope === "open"
              ? "Ai cũng tham gia"
              : "Theo chi đoàn được giao"}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="p-2 text-slate-500 hover:text-slate-800"
          title="Tải lại"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {mySubmission && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold ${
            mySubmission.status === "approved"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : mySubmission.status === "rejected"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {mySubmission.status === "approved" &&
            "Bài nộp đã được bí thư chi đoàn xác nhận."}
          {mySubmission.status === "rejected" &&
            `Bài nộp bị từ chối${mySubmission.review_note ? `: ${mySubmission.review_note}` : ""}. Bạn nộp lại được.`}
          {mySubmission.status === "pending" &&
            "Bài nộp đang chờ bí thư chi đoàn xác nhận."}
        </div>
      )}

      {activeTask.content && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-line">
          {activeTask.content}
        </div>
      )}

      {activeTask.lat !== null && activeTask.lng !== null && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2 text-xs">
          <p className="font-bold text-doan flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Điểm danh vị trí
          </p>
          <p className="text-slate-700">
            Bạn cần ở trong bán kính <b>{appliedRadius} m</b> quanh điểm tổ
            chức. Nên dùng điện thoại và bật định vị để có toạ độ chính xác.
          </p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${activeTask.lat},${activeTask.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold text-doan hover:underline"
          >
            <MapPin className="w-3 h-3" /> Xem vị trí trên Google Maps
          </a>

          {/* Nhắc nháp khi mọi ảnh đã có GPS. Kết quả chính thức do DB tính. */}
          {draftDistance !== null && (
            <p
              className={`font-semibold flex items-start gap-1 ${
                draftDistance > appliedRadius
                  ? "text-rose-700"
                  : "text-emerald-700"
              }`}
            >
              {draftDistance > appliedRadius ? (
                <>
                  ⚠️ Có vẻ bạn đang <b>ngoài phạm vi</b> (ước tính ~
                  {Math.round(draftDistance)} m). Kết quả chính thức do hệ thống
                  tính khi bạn nộp.
                </>
              ) : (
                <>
                  ✓ Ước tính bạn đang <b>trong phạm vi</b> (~
                  {Math.round(draftDistance)} m). Kết quả chính thức do hệ thống
                  tính khi bạn nộp.
                </>
              )}
            </p>
          )}

          {activeTask.attendance_open_at || activeTask.attendance_close_at ? (
            <p className="text-[11px] text-slate-600">
              Điểm danh mở
              {activeTask.attendance_open_at &&
                ` từ ${formatDateTimeVN(activeTask.attendance_open_at)}`}
              {activeTask.attendance_close_at &&
                ` đến ${formatDateTimeVN(activeTask.attendance_close_at)}`}
              . Nộp ngoài khung vẫn được nhưng sẽ gắn nhãn "Ngoài giờ".
            </p>
          ) : null}
        </div>
      )}

      {locked ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          Bài nộp đã được duyệt nên không sửa được nữa. Nếu cần điều chỉnh, liên
          hệ bí thư chi đoàn.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Ghi chú (tuỳ chọn):
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg resize-none"
              placeholder="Mô tả ngắn về việc bạn đã làm..."
            />
          </div>

          {/* Toạ độ nhập tay */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500" /> Toạ độ GPS (nhập
              tay khi trình duyệt chặn định vị)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="p-2 bg-white border border-slate-300 rounded-lg"
                placeholder="Vĩ độ (lat), vd 9.18240"
              />
              <input
                type="text"
                inputMode="decimal"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="p-2 bg-white border border-slate-300 rounded-lg"
                placeholder="Kinh độ (lng), vd 105.15280"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[11px]">
                Hoặc dán link Google Maps:
              </label>
              <input
                type="text"
                value={mapLink}
                onChange={(e) => handlePasteMapLink(e.target.value)}
                className="w-full p-2 bg-white border border-slate-300 rounded-lg"
                placeholder="https://maps.app.goo.gl/... hoặc https://www.google.com/maps/@10.123,106.456,15z"
              />
              {mapLink.trim() &&
                (parseMapLink(mapLink) ? (
                  <p className="text-[11px] text-emerald-700 mt-1">
                    Đã nhận toạ độ: {parseMapLink(mapLink)!.lat.toFixed(5)},{" "}
                    {parseMapLink(mapLink)!.lng.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Không đọc được toạ độ từ link này. Link rút gọn
                    (maps.app.goo.gl) cần mở ra rồi sao chép link đầy đủ.
                  </p>
                ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-400">
                Bấm "Gán toạ độ" để điền vào các ảnh đang thiếu GPS.
              </p>
              <button
                title="Gán toạ độ"
                type="button"
                onClick={applyManualToPhotos}
                className="px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Gán toạ độ
              </button>
            </div>
          </div>

          {/* Ảnh minh chứng */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5" /> Ảnh minh chứng (
                {photos.length}/{maxPhotos})
              </span>
              <div className="flex items-center gap-2">
                <button
                  title="Chọn ảnh"
                  type="button"
                  disabled={busy || photos.length >= maxPhotos}
                  onClick={() => addPhoto("upload")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-doan rounded-lg disabled:opacity-50"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Chọn ảnh
                </button>
                <button
                  title="Chụp ảnh"
                  type="button"
                  disabled={busy || photos.length >= maxPhotos}
                  onClick={() => addPhoto("camera")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-50"
                >
                  <Camera className="w-3.5 h-3.5" /> Chụp ảnh
                </button>
              </div>
            </div>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((ev, i) => (
                  <div
                    key={i}
                    className="relative border border-slate-200 rounded-lg overflow-hidden bg-white"
                  >
                    <img
                      src={ev.url}
                      alt={ev.label}
                      className="w-full h-24 object-cover"
                    />
                    <button
                      title="Đóng"
                      type="button"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-1.5">
                      {ev.lat !== null && ev.lng !== null ? (
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-emerald-700 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />{" "}
                            {ev.lat.toFixed(5)}, {ev.lng.toFixed(5)}
                          </span>
                          {ev.coordSource && ev.coordSource !== "gps" && (
                            <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Không
                              xác thực
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[9px] text-amber-700 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Thiếu GPS
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {yearlySettings.require_gps && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Ảnh bắt buộc có toạ độ GPS
                mới nộp được.
              </p>
            )}
          </div>

          {/* Tệp minh chứng */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <FileUp className="w-3.5 h-3.5" /> Tệp minh chứng (
                {files.length}/{maxFiles})
              </span>
              <button
                title="Chọn tệp"
                type="button"
                disabled={busy || files.length >= maxFiles}
                onClick={addFile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-50"
              >
                <FileUp className="w-3.5 h-3.5" /> Chọn tệp
              </button>
            </div>
            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((ev, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                  >
                    <span className="text-[11px] text-slate-700 flex items-center gap-1.5 truncate">
                      <FileText className="w-3.5 h-3.5 shrink-0" /> {ev.label}
                    </span>
                    <button
                      title="Đóng"
                      type="button"
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link minh chứng */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5" /> Link minh chứng ({linkCount}/
              {maxLinks})
            </span>
            <textarea
              rows={2}
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg resize-none"
              placeholder="Dán các đường link, cách nhau bởi dấu phẩy..."
            />
          </div>

          {/* Ghi chú minh chứng */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Ghi chú minh chứng
            </span>
            <textarea
              rows={2}
              value={noteEvidence}
              onChange={(e) => setNoteEvidence(e.target.value)}
              className="w-full p-2 bg-white border border-slate-300 rounded-lg resize-none"
              placeholder="Nội dung ghi chú / mô tả thêm (không cần tệp)..."
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              Người nộp: {currentMember.full_name}
              {currentRole === "member" ? "" : " (hỗ trợ)"}
            </span>
            <button
              title="Hoàn thành"
              type="button"
              disabled={busy}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {mySubmission ? "Nộp lại" : "Nộp minh chứng"}
            </button>
          </div>
        </div>
      )}

      {scanOpen && <QrScanModal onClose={() => setScanOpen(false)} />}
    </div>
  );
};
