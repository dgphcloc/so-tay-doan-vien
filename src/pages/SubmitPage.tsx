import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { sha256Hex, sha256HexOfString, getGpsPosition, pickImageFile, pickAnyFile, captureFromCamera } from '../utils/evidence';
import type { EvidenceInput } from '../data/repository';
import { formatDateVN } from '../mock/data';
import {
  Upload, Camera, MapPin, CheckCircle2, AlertTriangle, Loader2, ClipboardList, Users,
  ImagePlus, X, RefreshCw, FileText, Link2, StickyNote, FileUp,
} from 'lucide-react';

/** Minh chứng đã sẵn sàng gửi kèm (đã upload / đã băm). */
interface ReadyEvidence extends EvidenceInput {
  /** Nhãn hiển thị ngắn cho UI. */
  label: string;
}

export const SubmitPage: React.FC = () => {
  const {
    currentUser, currentMember, currentRole, yearlySettings,
    listMyTodo, uploadEvidence, submitTaskResult, submitCriterionSubmission, showToast,
    listTaskParticipants,
  } = useApp();

  // Tiến độ đoàn viên của nhiệm vụ đang chọn: { đã nộp, đã duyệt, tên chưa nộp }
  const [progress, setProgress] = useState<{ submitted: number; approved: number; total: number; notSubmitted: string[] } | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const unitId = currentMember?.unit_id ?? null;
  const maxPhotos = yearlySettings.max_photos ?? 3;
  const maxFiles = yearlySettings.max_files ?? 3;
  const maxLinks = yearlySettings.max_links ?? 5;

  const [loading, setLoading] = useState(true);
  const [todo, setTodo] = useState<Awaited<ReturnType<typeof listMyTodo>> | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);

  const [participantCount, setParticipantCount] = useState(1);
  const [note, setNote] = useState('');

  const [photos, setPhotos] = useState<ReadyEvidence[]>([]);
  const [files, setFiles] = useState<ReadyEvidence[]>([]);
  const [linksText, setLinksText] = useState('');
  const [noteEvidence, setNoteEvidence] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!unitId) { setLoading(false); return; }
    setLoading(true);
    try {
      setTodo(await listMyTodo(unitId));
    } catch (e) {
      showToast({ title: 'Không tải được việc cần nộp', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [unitId]);

  const activeTask = useMemo(() => todo?.tasks.find(t => t.task.id === activeId) ?? null, [todo, activeId]);

  // Tải tiến độ đoàn viên mỗi khi chọn nhiệm vụ khác
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeTask || !unitId) { setProgress(null); return; }
      setLoadingProgress(true);
      try {
        const rows = await listTaskParticipants(activeTask.task.id, unitId);
        if (cancelled) return;
        const submitted = rows.filter(r => !!r.submission).length;
        const approved = rows.filter(r => r.submission?.status === 'approved').length;
        setProgress({
          submitted,
          approved,
          total: rows.length,
          notSubmitted: rows.filter(r => !r.submission).map(r => r.member.full_name),
        });
        // Số người tham gia = số bài đã duyệt, không cho sửa
        setParticipantCount(approved);
      } catch {
        if (!cancelled) setProgress(null);
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [activeTask?.task.id, unitId]);

  const resetForm = () => {
    setParticipantCount(1);
    setNote('');
    setPhotos([]);
    setFiles([]);
    setLinksText('');
    setNoteEvidence('');
    setActiveId(null);
  };

  const selectItem = (id: string) => {
    setActiveId(id);
    setNote('');
    setPhotos([]);
    setFiles([]);
    setLinksText('');
    setNoteEvidence('');
    setParticipantCount(1);
  };

  /** Thêm ảnh: tải lên Storage + GPS + băm SHA-256. */
  const addPhoto = async (source: 'camera' | 'upload') => {
    if (!unitId) return;
    if (photos.length >= maxPhotos) {
      showToast({ title: `Tối đa ${maxPhotos} ảnh`, description: 'Vào Cấu hình để tăng giới hạn.', type: 'error' });
      return;
    }
    try {
      const file = source === 'camera' ? await captureFromCamera() : await pickImageFile();
      if (!file) return;
      setBusy(true);
      let lat: number | null = null, lng: number | null = null;
      try {
        const pos = await getGpsPosition();
        lat = pos.lat; lng = pos.lng;
      } catch (e) {
        showToast({ title: 'Không lấy được GPS', description: e instanceof Error ? e.message : '', type: 'info' });
      }
      const [hash, up] = await Promise.all([sha256Hex(file), uploadEvidence(file, unitId)]);
      setPhotos(prev => [...prev, {
        evidenceType: 'photo', url: up.url, storagePath: up.storagePath, fileName: file.name,
        fileHash: hash, lat, lng, source, label: file.name,
      }]);
      showToast({ title: 'Đã thêm ảnh minh chứng', type: 'success' });
    } catch (e) {
      showToast({ title: 'Không thêm được ảnh', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  /** Thêm file (PDF/Word...) — không cần GPS. */
  const addFile = async () => {
    if (!unitId) return;
    if (files.length >= maxFiles) {
      showToast({ title: `Tối đa ${maxFiles} tệp`, description: 'Vào Cấu hình để tăng giới hạn.', type: 'error' });
      return;
    }
    try {
      const file = await pickAnyFile();
      if (!file) return;
      setBusy(true);
      const [hash, up] = await Promise.all([sha256Hex(file), uploadEvidence(file, unitId)]);
      setFiles(prev => [...prev, {
        evidenceType: 'file', url: up.url, storagePath: up.storagePath, fileName: file.name,
        fileHash: hash, lat: null, lng: null, source: 'upload', label: file.name,
      }]);
      showToast({ title: 'Đã thêm tệp minh chứng', type: 'success' });
    } catch (e) {
      showToast({ title: 'Không thêm được tệp', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  /** Gom toàn bộ minh chứng thành mảng để gửi (link tách theo dấu phẩy). */
  const buildEvidences = async (): Promise<EvidenceInput[]> => {
    const list: EvidenceInput[] = [...photos, ...files];

    const links = linksText.split(',').map(s => s.trim()).filter(Boolean).slice(0, maxLinks);
    for (const url of links) {
      const hash = await sha256HexOfString(url);
      list.push({ evidenceType: 'link', url, storagePath: '', fileName: url, fileHash: hash, lat: null, lng: null, source: 'upload' });
    }
    if (noteEvidence.trim()) {
      const text = noteEvidence.trim();
      const hash = await sha256HexOfString(text);
      list.push({ evidenceType: 'list', url: '', storagePath: '', fileName: text, fileHash: hash, lat: null, lng: null, source: 'upload' });
    }
    return list;
  };

  const handleSubmit = async () => {
    if (!unitId || !activeId) return;

    // Bài tổng hợp phải có căn cứ: ít nhất 1 bài đoàn viên đã duyệt
    if (!progress || progress.approved === 0) {
      showToast({
        title: 'Chưa thể nộp bài tổng hợp',
        description: 'Cần ít nhất một bài nộp của đoàn viên được duyệt trước khi tổng hợp.',
        type: 'error',
      });
      return;
    }

    // Chặn nộp nếu ảnh thiếu GPS (theo cấu hình)
    if (yearlySettings.require_gps && photos.some(p => p.lat === null || p.lng === null)) {
      showToast({
        title: 'Thiếu toạ độ GPS',
        description: 'Ảnh minh chứng bắt buộc có toạ độ GPS. Hãy bật quyền vị trí cho trang web.',
        type: 'error',
      });
      return;
    }

    setBusy(true);
    try {
      const evidences = await buildEvidences();
      if (activeTask) {
        const res = await submitTaskResult({
          taskId: activeTask.task.id, unitId, participantCount: Number(participantCount) || 0,
          note: note.trim() || undefined, lat: null, lng: null,
          isOverdue: activeTask.deadlineStatus.is_overdue, evidences,
        });
        if (res.success) { showToast({ title: 'Đã nộp kết quả nhiệm vụ', type: 'success' }); resetForm(); await reload(); }
        else showToast({ title: 'Không nộp được', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập để nộp minh chứng.</div>;
  }
  if (currentRole === 'member') {
    return (
      <div className="p-8 text-center text-slate-500">
        Trang này dành cho bí thư chi đoàn nộp bài tổng hợp. Đoàn viên vui lòng nộp minh chứng cá nhân tại mục "Nộp cá nhân".
      </div>
    );
  }
  if (!unitId) {
    return (
      <div className="p-8 text-center text-slate-500">
        Tài khoản chưa gắn với chi đoàn nào. Liên hệ cán bộ Đoàn xã để được gắn hồ sơ đoàn viên.
      </div>
    );
  }

  const tasksTodo = todo?.tasks.filter(t => !t.alreadySubmitted || t.alreadySubmitted.status === 'rejected') ?? [];
  const linkCount = linksText.split(',').map(s => s.trim()).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <Upload className="w-6 h-6 text-[#1F5FBF]" />
          Nộp minh chứng
        </h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          Nộp kết quả nhiệm vụ và bài tự chấm tiêu chí kèm minh chứng (ảnh + GPS, tệp, link, ghi chú).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái: danh sách việc phải nộp */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex-1 py-2 text-xs font-bold rounded-lg bg-[#1F5FBF] text-white text-center">
              Nhiệm vụ ({tasksTodo.length})
            </span>
            <button type="button" onClick={reload} className="p-2 text-slate-500 hover:text-slate-800" title="Tải lại">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {tasksTodo.length === 0 && <p className="p-6 text-center text-slate-400 text-xs">Không có nhiệm vụ nào cần nộp.</p>}
              {tasksTodo.map(({ task, deadlineStatus, alreadySubmitted }) => (
                <div key={task.id} onClick={() => selectItem(task.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${activeId === task.id ? 'border-[#1F5FBF] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <p className="text-xs font-bold text-slate-900 line-clamp-2">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-slate-500">Hạn: {formatDateVN(task.due_date)}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      deadlineStatus.chip_color === 'rose' ? 'bg-rose-100 text-rose-700'
                      : deadlineStatus.chip_color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {deadlineStatus.chip_label}
                    </span>
                    <span className="text-[10px] font-bold text-[#1F5FBF]">{task.max_score}đ</span>
                    {alreadySubmitted?.status === 'rejected' && (
                      <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">Bị từ chối</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cột phải: form nộp */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
          {!activeId ? (
            <div className="p-10 text-center text-slate-400">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Chọn một mục bên trái để nộp minh chứng.</p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              <div className="pb-3 border-b border-slate-100">
                <span className="text-[10px] uppercase font-bold text-[#1F5FBF] bg-blue-50 px-2 py-0.5 rounded">
                  Nộp kết quả nhiệm vụ
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1.5">
                  {activeTask?.task.title}
                </h3>

              </div>

              {
                <div className="space-y-3">
                  {/* Tiến độ đoàn viên */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg space-y-1.5">
                    <p className="font-bold text-[#1F5FBF] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Tiến độ đoàn viên
                    </p>
                    {loadingProgress ? (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Đang tải…
                      </p>
                    ) : progress ? (
                      <>
                        <p className="text-[11px] text-slate-700">
                          <b>{progress.submitted}/{progress.total}</b> đoàn viên đã nộp •{' '}
                          <b className="text-emerald-700">{progress.approved}</b> đã duyệt
                        </p>
                        {progress.notSubmitted.length > 0 && (
                          <p className="text-[11px] text-amber-800">
                            Chưa nộp ({progress.notSubmitted.length}): {progress.notSubmitted.join(', ')}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[11px] text-slate-500">Chưa có dữ liệu.</p>
                    )}
                  </div>

                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Số người tham gia (tự động = số bài đã duyệt):
                    </label>
                    <input type="number" readOnly value={participantCount}
                      className="w-full p-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-700 cursor-not-allowed" />
                    {progress && progress.approved === 0 && (
                      <p className="text-[11px] text-rose-600 mt-1">
                        Chưa có bài đoàn viên nào được duyệt — không thể nộp bài tổng hợp.
                      </p>
                    )}
                  </div>
                </div>
              }

              <div>
                <label className="font-bold text-slate-800 block mb-1">Ghi chú (tuỳ chọn):</label>
                <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg resize-none"
                  placeholder="Mô tả ngắn về kết quả thực hiện..." />
              </div>

              {/* Ảnh minh chứng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" /> Ảnh minh chứng ({photos.length}/{maxPhotos})
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busy || photos.length >= maxPhotos} onClick={() => addPhoto('upload')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#1F5FBF] rounded-lg disabled:opacity-50">
                      <ImagePlus className="w-3.5 h-3.5" /> Chọn ảnh
                    </button>
                    <button type="button" disabled={busy || photos.length >= maxPhotos} onClick={() => addPhoto('camera')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-50">
                      <Camera className="w-3.5 h-3.5" /> Chụp ảnh
                    </button>
                  </div>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {photos.map((ev, i) => (
                      <div key={i} className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <img src={ev.url} alt={ev.label} className="w-full h-24 object-cover" />
                        <button type="button" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-rose-600"><X className="w-3.5 h-3.5" /></button>
                        <div className="p-1.5 space-y-0.5">
                          {ev.lat !== null && ev.lng !== null ? (
                            <span className="text-[9px] text-emerald-700 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {ev.lat.toFixed(5)}, {ev.lng.toFixed(5)}</span>
                          ) : (
                            <span className="text-[9px] text-amber-700 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Thiếu GPS</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {yearlySettings.require_gps && (
                  <p className="text-[11px] text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Ảnh bắt buộc có toạ độ GPS mới nộp được.</p>
                )}
              </div>

              {/* Tệp minh chứng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileUp className="w-3.5 h-3.5" /> Tệp minh chứng ({files.length}/{maxFiles})
                  </span>
                  <button type="button" disabled={busy || files.length >= maxFiles} onClick={addFile}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-50">
                    <FileUp className="w-3.5 h-3.5" /> Chọn tệp
                  </button>
                </div>
                {files.length > 0 && (
                  <div className="space-y-1">
                    {files.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                        <span className="text-[11px] text-slate-700 flex items-center gap-1.5 truncate"><FileText className="w-3.5 h-3.5 shrink-0" /> {ev.label}</span>
                        <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-rose-600"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link minh chứng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Link minh chứng ({linkCount}/{maxLinks})
                </span>
                <textarea rows={2} value={linksText} onChange={e => setLinksText(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg resize-none"
                  placeholder="Dán các đường link, cách nhau bởi dấu phẩy. Ví dụ: https://..., https://..." />
                <p className="text-[11px] text-slate-400">Mỗi link cách nhau dấu phẩy sẽ thành một minh chứng riêng.</p>
              </div>

              {/* Ghi chú minh chứng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" /> Ghi chú minh chứng
                </span>
                <textarea rows={2} value={noteEvidence} onChange={e => setNoteEvidence(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg resize-none"
                  placeholder="Nội dung ghi chú / mô tả thêm (không cần tệp)..." />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button type="button" onClick={resetForm} className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Huỷ</button>
                <button type="button" disabled={busy} onClick={handleSubmit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Nộp minh chứng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
