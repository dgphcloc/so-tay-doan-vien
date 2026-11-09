import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useConfirm } from '../common/ConfirmDialog';
import { pickImageFile, pickAnyFile, captureFromCamera, sha256Hex, sha256HexOfString } from '../../utils/evidence';
import type { EvidenceInput } from '../../data/repository';
import type { Evidence } from '../../types';
import { formatDateVN, formatDateTimeVN } from '../../mock/data';
import {
  X, Loader2, ImagePlus, FileUp, Link2, StickyNote, Camera, CheckCircle2,
  Clock, XCircle, AlertTriangle, BadgeCheck, Send,
} from 'lucide-react';

interface ReadyEvidence extends EvidenceInput {
  label: string;
}

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
  /** Gọi sau khi nộp thành công để trang cha nạp lại dữ liệu. */
  onSubmitted?: () => void;
}

const MAX_PHOTOS = 5;
const MAX_FILES = 3;
const MAX_LINKS = 5;

/**
 * Modal NỘP BÁO CÁO của Bí thư / Phó Bí thư chi đoàn.
 *
 * Khác với `task_results` (kết quả tổng hợp của chi đoàn: số người tham gia,
 * kết quả đạt được), đây là BÁO CÁO RIÊNG về quá trình chỉ đạo: phân công,
 * khó khăn, đề xuất. Hai thứ độc lập, cùng tồn tại.
 *
 * Mỗi chi đoàn chỉ có MỘT báo cáo cho mỗi nhiệm vụ. Nộp lại được khi bị từ chối.
 */
export const UnitReportModal: React.FC<Props> = ({ taskId, taskTitle, onClose, onSubmitted }) => {
  const {
    currentMember, unitReports, submitUnitReport, listUnitReportEvidences,
    uploadEvidence, showToast, getUnitById, getMemberById,
  } = useApp();
  const { confirm } = useConfirm();

  const myUnitId = currentMember?.unit_id ?? null;

  // Báo cáo đã có của chi đoàn mình cho nhiệm vụ này
  const existing = unitReports.find(r => r.task_id === taskId && r.unit_id === myUnitId) ?? null;
  const isApproved = existing?.status === 'approved';

  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<ReadyEvidence[]>([]);
  const [files, setFiles] = useState<ReadyEvidence[]>([]);
  const [linksText, setLinksText] = useState('');
  const [noteEvidence, setNoteEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingEv, setLoadingEv] = useState(false);

  // Nộp lại: nạp minh chứng cũ để người dùng thấy đã gửi gì
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!existing) { setPhotos([]); setFiles([]); setNoteEvidence(''); return; }
      setNote(existing.note ?? '');
      setLoadingEv(true);
      try {
        const evs: Evidence[] = await listUnitReportEvidences(existing.id);
        if (cancelled) return;
        setPhotos(evs.filter(e => e.evidence_type === 'photo').map(e => ({
          evidenceType: 'photo', url: e.url, storagePath: e.storage_path, fileName: e.file_name,
          fileHash: e.file_hash, lat: e.lat, lng: e.lng, source: e.source, label: e.file_name || 'Ảnh',
        })));
        setFiles(evs.filter(e => e.evidence_type === 'file').map(e => ({
          evidenceType: 'file', url: e.url, storagePath: e.storage_path, fileName: e.file_name,
          fileHash: e.file_hash, lat: e.lat, lng: e.lng, source: e.source, label: e.file_name || 'Tệp',
        })));
        setLinksText(evs.filter(e => e.evidence_type === 'link').map(e => e.url).join(', '));
        setNoteEvidence(evs.filter(e => e.evidence_type === 'list').map(e => e.file_name).join(' • '));
      } catch {
        // Minh chứng cũ không đọc được thì bỏ qua, vẫn nộp được bộ mới
      } finally {
        if (!cancelled) setLoadingEv(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [existing?.id]);

  const addPhoto = async (source: 'camera' | 'upload') => {
    if (!myUnitId) return;
    if (photos.length >= MAX_PHOTOS) {
      showToast({ title: `Tối đa ${MAX_PHOTOS} ảnh`, type: 'error' });
      return;
    }
    try {
      const file = source === 'camera' ? await captureFromCamera() : await pickImageFile();
      if (!file) return;
      setBusy(true);
      const [hash, up] = await Promise.all([sha256Hex(file), uploadEvidence(file, myUnitId)]);
      setPhotos(prev => [...prev, {
        evidenceType: 'photo', url: up.url, storagePath: up.storagePath, fileName: file.name,
        fileHash: hash, lat: null, lng: null, source, label: file.name, coordSource: null,
      }]);
      showToast({ title: 'Đã thêm ảnh', type: 'success' });
    } catch (e) {
      showToast({ title: 'Không thêm được ảnh', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const addFile = async () => {
    if (!myUnitId) return;
    if (files.length >= MAX_FILES) {
      showToast({ title: `Tối đa ${MAX_FILES} tệp`, type: 'error' });
      return;
    }
    try {
      const file = await pickAnyFile();
      if (!file) return;
      setBusy(true);
      const [hash, up] = await Promise.all([sha256Hex(file), uploadEvidence(file, myUnitId)]);
      setFiles(prev => [...prev, {
        evidenceType: 'file', url: up.url, storagePath: up.storagePath, fileName: file.name,
        fileHash: hash, lat: null, lng: null, source: 'upload', label: file.name, coordSource: null,
      }]);
      showToast({ title: 'Đã thêm tệp', type: 'success' });
    } catch (e) {
      showToast({ title: 'Không thêm được tệp', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const buildEvidences = async (): Promise<EvidenceInput[]> => {
    const list: EvidenceInput[] = [...photos, ...files];
    const links = linksText.split(',').map(s => s.trim()).filter(Boolean).slice(0, MAX_LINKS);
    for (const url of links) {
      const hash = await sha256HexOfString(url);
      list.push({
        evidenceType: 'link', url, storagePath: '', fileName: url, fileHash: hash,
        lat: null, lng: null, source: 'upload', coordSource: null,
      });
    }
    if (noteEvidence.trim()) {
      const text = noteEvidence.trim();
      const hash = await sha256HexOfString(text);
      list.push({
        evidenceType: 'list', url: '', storagePath: '', fileName: text, fileHash: hash,
        lat: null, lng: null, source: 'upload', coordSource: null,
      });
    }
    return list;
  };

  const handleSubmit = async () => {
    if (!note.trim()) {
      showToast({ title: 'Chưa nhập nội dung báo cáo', description: 'Vui lòng mô tả công tác chỉ đạo, khó khăn, đề xuất.', type: 'error' });
      return;
    }

    const ok = await confirm({
      title: existing ? 'Nộp lại báo cáo?' : 'Nộp báo cáo chi đoàn?',
      message: existing
        ? 'Báo cáo cũ sẽ được thay bằng nội dung mới và chuyển về trạng thái "Chờ duyệt".'
        : 'Báo cáo sẽ được gửi tới Bí thư Đoàn xã để duyệt.',
      variant: 'info',
      confirmText: existing ? 'Nộp lại' : 'Nộp báo cáo',
    });
    if (!ok) return;

    setSaving(true);
    try {
      const evidences = await buildEvidences();
      const res = await submitUnitReport({ taskId, note: note.trim() || undefined, evidences });
      if (res.success) {
        showToast({ title: 'Đã gửi báo cáo', description: 'Chờ Bí thư Đoàn xã duyệt.', type: 'success' });
        onSubmitted?.();
        onClose();
      } else {
        showToast({ title: 'Không nộp được', description: res.message, type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const linkCount = linksText.split(',').map(s => s.trim()).filter(Boolean).length;
  const unitName = getUnitById(myUnitId)?.name ?? 'chi đoàn';
  const submitter = existing ? getMemberById(existing.submitted_by) : null;

  /** Nhãn trạng thái của báo cáo hiện có. */
  const StatusBanner = () => {
    if (!existing) return null;
    if (existing.status === 'approved') {
      return (
        <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-800 flex items-start gap-2">
          <BadgeCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Báo cáo đã được duyệt</p>
            <p className="mt-0.5">
              Duyệt lúc {formatDateTimeVN(existing.reviewed_at ?? '')}
              {existing.review_note ? ` • Nhận xét: ${existing.review_note}` : ''}
            </p>
          </div>
        </div>
      );
    }
    if (existing.status === 'rejected') {
      return (
        <div className="p-3 rounded-xl border bg-rose-50 border-rose-200 text-rose-800 flex items-start gap-2">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Báo cáo bị từ chối</p>
            {existing.review_note && <p className="mt-0.5">Lý do: {existing.review_note}</p>}
            <p className="mt-0.5">Bạn có thể sửa và nộp lại.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="p-3 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 flex items-start gap-2">
        <Clock className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Báo cáo đang chờ duyệt</p>
          <p className="mt-0.5">Nộp lúc {formatDateTimeVN(existing.submitted_at)}. Bạn vẫn sửa và nộp lại được.</p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[150] w-screen h-screen flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-[#1F5FBF] shrink-0" />
              Báo cáo của Bí thư chi đoàn
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{taskTitle}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {unitName}
              {submitter ? ` • Người nộp: ${submitter.full_name}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Đóng cửa sổ, không lưu thay đổi"
            className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#1F5FBF]" />
            <div>
              <p className="font-bold">Đây là báo cáo riêng của Bí thư / Phó Bí thư</p>
              <p className="mt-0.5">
                Ghi công tác chỉ đạo, phân công, khó khăn, đề xuất. Khác với
                “Kết quả nhiệm vụ” (sản phẩm chung của chi đoàn).
              </p>
            </div>
          </div>

          <StatusBanner />

          {isApproved ? (
            <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              Báo cáo đã được duyệt nên không sửa được nữa.
              {existing?.note && (
                <p className="mt-2 text-left text-slate-700 whitespace-pre-line">{existing.note}</p>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Nội dung báo cáo <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="VD: Đã phân công 3 tổ đến từng ấp; khó khăn: 2 hộ không có điện thoại thông minh; đề xuất: hỗ trợ thêm 5 máy tính bảng..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg resize-none focus:outline-none focus:border-[#1F5FBF] focus:bg-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">{note.length} ký tự</p>
              </div>

              {/* Ảnh */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5" /> Ảnh kèm theo ({photos.length}/{MAX_PHOTOS})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      title="Chọn ảnh từ máy"
                      type="button"
                      disabled={busy || photos.length >= MAX_PHOTOS}
                      onClick={() => addPhoto('upload')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-[#1F5FBF] rounded-lg disabled:opacity-50"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Chọn ảnh
                    </button>
                    <button
                      title="Chụp ảnh bằng camera"
                      type="button"
                      disabled={busy || photos.length >= MAX_PHOTOS}
                      onClick={() => addPhoto('camera')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5" /> Chụp ảnh
                    </button>
                  </div>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photos.map((ev, i) => (
                      <div key={i} className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
                        <img src={ev.url} alt={ev.label} className="w-full h-20 object-cover" />
                        <button
                          title="Xoá ảnh này"
                          type="button"
                          onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-rose-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tệp */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileUp className="w-3.5 h-3.5" /> Tệp đính kèm ({files.length}/{MAX_FILES})
                  </span>
                  <button
                    title="Chọn tệp từ máy"
                    type="button"
                    disabled={busy || files.length >= MAX_FILES}
                    onClick={addFile}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg disabled:opacity-50"
                  >
                    <FileUp className="w-3.5 h-3.5" /> Chọn tệp
                  </button>
                </div>
                {files.length > 0 && (
                  <div className="space-y-1">
                    {files.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1.5">
                        <span className="text-[11px] text-slate-700 truncate">{ev.label}</span>
                        <button
                          title="Xoá tệp này"
                          type="button"
                          onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                          className="text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5" /> Link ({linkCount}/{MAX_LINKS})
                </span>
                <textarea
                  rows={2}
                  value={linksText}
                  onChange={e => setLinksText(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg resize-none"
                  placeholder="Dán các đường link, cách nhau bởi dấu phẩy..."
                />
              </div>

              {/* Ghi chú minh chứng */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" /> Ghi chú thêm
                </span>
                <textarea
                  rows={2}
                  value={noteEvidence}
                  onChange={e => setNoteEvidence(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg resize-none"
                  placeholder="Nội dung mô tả thêm (không cần tệp)..."
                />
              </div>

              {loadingEv && (
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Đang nạp minh chứng cũ…
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">
            {existing
              ? `Báo cáo nộp lần đầu: ${formatDateVN(existing.submitted_at)}`
              : 'Mỗi chi đoàn chỉ có một báo cáo cho mỗi nhiệm vụ.'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              title="Đóng, không lưu"
              className="px-3 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Đóng
            </button>
            {!isApproved && (
              <button
                type="button"
                disabled={saving || busy}
                onClick={handleSubmit}
                title={existing ? 'Nộp lại báo cáo và chuyển về trạng thái chờ duyệt' : 'Gửi báo cáo tới Bí thư Đoàn xã'}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {saving ? 'Đang gửi…' : existing ? 'Nộp lại' : 'Nộp báo cáo'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};