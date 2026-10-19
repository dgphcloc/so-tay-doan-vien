import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Evidence } from '../../types';
import { formatDateVN, formatDateTimeVN } from '../../mock/data';
import {
  Loader2, RefreshCw, CheckCircle2, XCircle, Users, MapPin, AlertTriangle, Camera,
  FileText, Link2, StickyNote, Search, Clock, BadgeCheck, Maximize2, X, ChevronLeft, ChevronRight,
} from 'lucide-react';

type TabKey = 'pending' | 'approved' | 'rejected' | 'all';

/**
 * Duyệt bài nộp CÁ NHÂN của đoàn viên (cấp chi đoàn).
 * RLS tự giới hạn: bí thư chi đoàn chỉ thấy bài của chi đoàn mình, bí thư xã thấy tất cả.
 */
export const MemberSubmissionsPanel: React.FC = () => {
  const {
    currentRole, currentMember, memberSubmissions, units, members,
    reviewMemberSubmission, listMemberSubmissionEvidences, getTaskById, showToast, approveAllMemberSubmissions,
  } = useApp();

  // Bước 1: chọn nhiệm vụ. null = đang ở danh sách nhiệm vụ.
  const [taskId, setTaskId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('pending');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loadingEv, setLoadingEv] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [lightbox, setLightbox] = useState<Evidence | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const isAdmin = currentRole === 'super_admin' || currentRole === 'admin';
  // Bí thư chi đoàn chỉ xem chi đoàn mình
  const scoped = useMemo(
    () => (isAdmin ? memberSubmissions : memberSubmissions.filter(s => s.unit_id === currentMember?.unit_id)),
    [memberSubmissions, isAdmin, currentMember?.unit_id]
  );

  /** Bài nộp của nhiệm vụ đang chọn (null = xem toàn bộ). */
  const scopedByTask = useMemo(
    () => (taskId ? scoped.filter(s => s.task_id === taskId) : scoped),
    [scoped, taskId]
  );

  const counts = useMemo(() => ({
    pending: scopedByTask.filter(s => s.status === 'pending').length,
    approved: scopedByTask.filter(s => s.status === 'approved').length,
    rejected: scopedByTask.filter(s => s.status === 'rejected').length,
    all: scopedByTask.length,
  }), [scopedByTask]);

  const filtered = useMemo(() => scopedByTask.filter(s => {
    if (tab !== 'all' && s.status !== tab) return false;
    if (unitFilter !== 'all' && s.unit_id !== unitFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const m = members.find(x => x.id === s.member_id);
      const t = getTaskById(s.task_id);
      const u = units.find(x => x.id === s.unit_id);
      const hay = [m?.full_name, t?.title, u?.name, s.note].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()),
  [scopedByTask, tab, unitFilter, search, members, units, getTaskById]);

  const selected = useMemo(() => filtered.find(s => s.id === selectedId) ?? null, [filtered, selectedId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selected) { setEvidences([]); return; }
      setLoadingEv(true);
      try {
        const evs = await listMemberSubmissionEvidences(selected.id);
        if (!cancelled) setEvidences(evs);
      } catch {
        if (!cancelled) setEvidences([]);
      } finally {
        if (!cancelled) setLoadingEv(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [selected?.id]);

  const handleReview = async (approve: boolean, note?: string) => {
    if (!selected) return;
    setBusy(true);
    const res = await reviewMemberSubmission(selected.id, approve, note);
    setBusy(false);
    if (res.success) {
      showToast({ title: approve ? 'Đã xác nhận bài nộp' : 'Đã từ chối bài nộp', type: 'success' });
      setRejecting(false); setRejectNote('');
    } else {
      showToast({ title: 'Không thực hiện được', description: res.message, type: 'error' });
    }
  };

  /** Nhóm bài nộp theo nhiệm vụ, để chọn nhiệm vụ trước khi xem danh sách. */
  const taskGroups = useMemo(() => {
    const map = new Map<string, { taskId: string; title: string; pending: number; total: number; latest: string }>();
    for (const s of scoped) {
      const t = getTaskById(s.task_id);
      const cur = map.get(s.task_id);
      const isPending = s.status === 'pending';
      if (!cur) {
        map.set(s.task_id, {
          taskId: s.task_id,
          title: t?.title ?? 'Nhiệm vụ',
          pending: isPending ? 1 : 0,
          total: 1,
          latest: s.submitted_at,
        });
      } else {
        cur.total += 1;
        if (isPending) cur.pending += 1;
        if (new Date(s.submitted_at) > new Date(cur.latest)) cur.latest = s.submitted_at;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.pending - a.pending || +new Date(b.latest) - +new Date(a.latest));
  }, [scoped, getTaskById]);

  const currentTaskTitle = taskId ? (getTaskById(taskId)?.title ?? 'Nhiệm vụ') : null;

  const photos = evidences.filter(e => e.evidence_type === 'photo');
  const files = evidences.filter(e => e.evidence_type === 'file');
  const links = evidences.filter(e => e.evidence_type === 'link');
  const notes = evidences.filter(e => e.evidence_type === 'list');

  const tabBtn = (key: TabKey, label: string) => (
    <button
      type="button"
      onClick={() => { setTab(key); setSelectedId(null); }}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
        tab === key ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label} ({counts[key]})
    </button>
  );

  // Bước 1: chưa chọn nhiệm vụ -> hiện danh sách nhiệm vụ có bài nộp
  if (!taskId) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Chọn một nhiệm vụ để xem danh sách đoàn viên đã nộp và duyệt từng bài.
        </p>
        {taskGroups.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
            Chưa có bài nộp nào cần duyệt.
          </p>
        ) : (
          <div className="space-y-2">
            {taskGroups.map(g => (
              <button
                key={g.taskId}
                type="button"
                onClick={() => { setTaskId(g.taskId); setSelectedId(null); }}
                className="w-full p-3.5 bg-white rounded-xl border border-slate-200 hover:border-[#1F5FBF] hover:bg-blue-50/30 text-left flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{g.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {g.total} bài nộp • gần nhất {formatDateTimeVN(g.latest)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {g.pending > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      {g.pending} chờ duyệt
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => { setTaskId(null); setSelectedId(null); }}
          className="inline-flex items-center gap-1 font-bold text-[#1F5FBF] hover:underline"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Danh sách nhiệm vụ
        </button>
        <span className="text-slate-300">|</span>
        <span className="font-semibold text-slate-700 truncate">{currentTaskTitle}</span>
        <button
          type="button"
          disabled={bulkBusy || counts.pending === 0}
          onClick={async () => {
            if (!taskId) return;
            setBulkBusy(true);
            try {
              const res = await approveAllMemberSubmissions(taskId);
              if (res.success) {
                showToast({
                  title: res.approved > 0 ? `Đã duyệt ${res.approved} bài` : 'Không có bài nào đang chờ',
                  type: res.approved > 0 ? 'success' : 'info',
                });
              } else {
                showToast({ title: 'Không duyệt được', description: res.message, type: 'error' });
              }
            } finally {
              setBulkBusy(false);
            }
          }}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
        >
          {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
          Duyệt tất cả ({counts.pending})
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabBtn('pending', 'Chờ duyệt')}
        {tabBtn('approved', 'Đã xác nhận')}
        {tabBtn('rejected', 'Bị từ chối')}
        {tabBtn('all', 'Tất cả')}
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên đoàn viên, chi đoàn..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
          />
        </div>
        {isAdmin && (
          <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]">
            <option value="all">Tất cả chi đoàn</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Danh sách bài nộp */}
        <div className="lg:col-span-5 space-y-2 max-h-[70vh] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="p-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">
              Không có bài nộp nào phù hợp.
            </p>
          )}
          {filtered.map(s => {
            const m = members.find(x => x.id === s.member_id);
            const u = units.find(x => x.id === s.unit_id);
            const t = getTaskById(s.task_id);
            return (
              <button
                key={s.id} type="button" onClick={() => { setSelectedId(s.id); setRejecting(false); }}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedId === s.id ? 'border-[#1F5FBF] bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">{m?.full_name ?? 'Đoàn viên'}</p>
                  {s.status === 'pending' ? (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">Chờ duyệt</span>
                  ) : s.status === 'approved' ? (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">Đã xác nhận</span>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">Từ chối</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{t?.title ?? 'Nhiệm vụ'}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500">
                  <span>{u?.name ?? '—'}</span>
                  <span>• {formatDateTimeVN(s.submitted_at)}</span>
                  {s.lat !== null && s.lng !== null && <span className="text-emerald-700">• có GPS</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Chi tiết bài nộp */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-4">
          {!selected ? (
            <p className="p-10 text-center text-slate-400 text-xs">Chọn một bài nộp bên trái để xem và xác nhận.</p>
          ) : (
            <>
              <div className="pb-3 border-b border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    {members.find(x => x.id === selected.member_id)?.full_name ?? 'Đoàn viên'}
                  </h3>
                  <button type="button" onClick={() => setSelectedId(null)} className="p-1 text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-1">{getTaskById(selected.task_id)?.title ?? 'Nhiệm vụ'}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {units.find(x => x.id === selected.unit_id)?.name ?? '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Nộp: {formatDateTimeVN(selected.submitted_at)}
                  </span>
                  {selected.lat !== null && selected.lng !== null ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <MapPin className="w-3 h-3" /> {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3 h-3" /> Không có GPS</span>
                  )}
                </div>
                {selected.note && (
                  <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 mt-2 whitespace-pre-line">
                    {selected.note}
                  </p>
                )}
              </div>

              {loadingEv ? (
                <div className="p-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : evidences.length === 0 ? (
                <p className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-lg">Bài nộp không kèm minh chứng.</p>
              ) : (
                <div className="space-y-3">
                  {photos.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" /> Ảnh ({photos.length})
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {photos.map(ev => (
                          <button key={ev.id} type="button" onClick={() => setLightbox(ev)}
                            className="relative border border-slate-200 rounded-lg overflow-hidden bg-white group">
                            <img src={ev.url} alt={ev.file_name} className="w-full h-24 object-cover" />
                            <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-slate-900/40 text-white">
                              <Maximize2 className="w-4 h-4" />
                            </span>
                            <span className="block p-1 text-[9px] truncate">
                              {ev.lat !== null && ev.lng !== null
                                ? <span className="text-emerald-700 flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}</span>
                                : <span className="text-amber-700 flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Thiếu GPS</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Tệp ({files.length})
                      </p>
                      <div className="space-y-1">
                        {files.map(ev => (
                          <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 text-[11px] text-[#1F5FBF] hover:underline">
                            <FileText className="w-3.5 h-3.5 shrink-0" /> {ev.file_name || ev.storage_path}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {links.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" /> Link ({links.length})
                      </p>
                      <div className="space-y-1">
                        {links.map(ev => (
                          <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer"
                            className="block text-[11px] text-[#1F5FBF] hover:underline break-all">{ev.url}</a>
                        ))}
                      </div>
                    </div>
                  )}

                  {notes.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                        <StickyNote className="w-3.5 h-3.5" /> Ghi chú minh chứng
                      </p>
                      {notes.map(ev => (
                        <p key={ev.id} className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 whitespace-pre-line">
                          {ev.file_name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selected.review_note && selected.status !== 'pending' && (
                <p className={`text-[11px] rounded-lg p-2 border ${
                  selected.status === 'rejected' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <span className="font-bold">Ghi chú duyệt: </span>{selected.review_note}
                </p>
              )}

              {rejecting ? (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <label className="text-[11px] font-bold text-slate-700 block">Lý do từ chối (bắt buộc):</label>
                  <textarea rows={3} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg resize-none focus:outline-none focus:border-rose-500"
                    placeholder="Ví dụ: Ảnh không rõ, thiếu toạ độ GPS, chưa đúng nội dung nhiệm vụ..." />
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => { setRejecting(false); setRejectNote(''); }}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Huỷ</button>
                    <button type="button" disabled={busy || !rejectNote.trim()} onClick={() => handleReview(false, rejectNote.trim())}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-60">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Xác nhận từ chối
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  {selected.status === 'pending' ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => setRejecting(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg disabled:opacity-60">
                        <XCircle className="w-3.5 h-3.5" /> Từ chối
                      </button>
                      <button type="button" disabled={busy} onClick={() => handleReview(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60">
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Xác nhận bài nộp
                      </button>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                      <BadgeCheck className="w-4 h-4" />
                      Đã xử lý{selected.reviewed_at ? ` • ${formatDateVN(selected.reviewed_at)}` : ''}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/80 p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full space-y-2" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.file_name} className="w-full max-h-[75vh] object-contain rounded-xl bg-black" />
            <div className="flex items-center justify-between text-white text-xs">
              <span className="truncate">{lightbox.file_name}</span>
              <button type="button" onClick={() => setLightbox(null)} className="inline-flex items-center gap-1 font-bold">
                <X className="w-4 h-4" /> Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
