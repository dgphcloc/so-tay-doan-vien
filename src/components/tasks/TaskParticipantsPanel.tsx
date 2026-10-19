import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { exportExcel } from '../../utils/exportExcel';
import { formatDateVN, formatDateTimeVN } from '../../mock/data';
import type { Evidence } from '../../types';
import {
  Loader2, RefreshCw, Search, Download, Users, MapPin, AlertTriangle, CheckCircle2,
  XCircle, Clock, Maximize2, X, Camera, FileText, Link2, StickyNote,
} from 'lucide-react';

type Row = Awaited<ReturnType<ReturnType<typeof useApp>['listTaskParticipantsAll']>>[number];
type SubmitFilter = 'all' | 'submitted' | 'approved' | 'pending' | 'rejected' | 'unsubmitted';
type JoinFilter = 'all' | 'joined' | 'rejected' | 'none';

/**
 * Tab "Đoàn viên tham gia" trong chi tiết nhiệm vụ.
 * Hiện trạng thái đăng ký + trạng thái nộp minh chứng cá nhân; bấm tên mở chi tiết ảnh.
 */
export const TaskParticipantsPanel: React.FC<{ taskId: string }> = ({ taskId }) => {
  const { listTaskParticipantsAll, listMemberSubmissionEvidences, units, showToast } = useApp();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [submitFilter, setSubmitFilter] = useState<SubmitFilter>('all');
  const [joinFilter, setJoinFilter] = useState<JoinFilter>('all');

  // Chi tiết một đoàn viên
  const [detail, setDetail] = useState<Row | null>(null);
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loadingEv, setLoadingEv] = useState(false);
  const [lightbox, setLightbox] = useState<Evidence | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      setRows(await listTaskParticipantsAll(taskId));
    } catch (e) {
      showToast({ title: 'Không tải được danh sách tham gia', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!detail?.submission) { setEvidences([]); return; }
      setLoadingEv(true);
      try {
        const evs = await listMemberSubmissionEvidences(detail.submission.id);
        if (!cancelled) setEvidences(evs);
      } catch {
        if (!cancelled) setEvidences([]);
      } finally {
        if (!cancelled) setLoadingEv(false);
      }
    })();
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [detail?.submission?.id]);

  const filtered = useMemo(() => rows.filter(r => {
    if (unitFilter !== 'all' && r.member.unit_id !== unitFilter) return false;

    if (joinFilter === 'joined' && r.isJoining !== true) return false;
    if (joinFilter === 'rejected' && r.isJoining !== false) return false;
    if (joinFilter === 'none' && r.isJoining !== null) return false;

    const st = r.submission?.status ?? 'unsubmitted';
    if (submitFilter !== 'all' && st !== submitFilter) return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [r.member.full_name, r.unit?.name, r.member.phone].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, unitFilter, joinFilter, submitFilter, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    joined: rows.filter(r => r.isJoining === true).length,
    submitted: rows.filter(r => !!r.submission).length,
    approved: rows.filter(r => r.submission?.status === 'approved').length,
  }), [rows]);

  const submitLabel = (r: Row) => {
    if (!r.submission) return { text: 'Chưa nộp', cls: 'bg-slate-100 text-slate-600' };
    if (r.submission.status === 'approved') return { text: 'Đã duyệt', cls: 'bg-emerald-100 text-emerald-800' };
    if (r.submission.status === 'rejected') return { text: 'Bị từ chối', cls: 'bg-rose-100 text-rose-800' };
    return { text: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800' };
  };

  const joinLabel = (r: Row) => {
    if (r.isJoining === true) return { text: 'Tham gia', cls: 'bg-emerald-100 text-emerald-800' };
    if (r.isJoining === false) return { text: 'Từ chối', cls: 'bg-rose-100 text-rose-800' };
    return { text: 'Chưa xác nhận', cls: 'bg-slate-100 text-slate-500' };
  };

  const handleExport = async () => {
    const exportRows = filtered.map(r => ({
      name: r.member.full_name,
      unit: r.unit?.name ?? '',
      join: joinLabel(r).text,
      submit: submitLabel(r).text,
      submitted_at: r.submission ? formatDateTimeVN(r.submission.submitted_at) : '',
      gps: r.submission && r.submission.lat !== null && r.submission.lng !== null
        ? `${r.submission.lat.toFixed(5)}, ${r.submission.lng.toFixed(5)}`
        : '',
      note: r.submission?.note ?? '',
    }));
    await exportExcel({
      fileName: `Danh_sach_tham_gia_nhiem_vu_${taskId}.xlsx`,
      sheetName: 'Tham gia',
      title: 'DANH SÁCH ĐOÀN VIÊN THAM GIA NHIỆM VỤ',
      columns: [
        { header: 'Họ và tên', key: 'name', width: 26 },
        { header: 'Chi đoàn', key: 'unit', width: 26 },
        { header: 'Đăng ký', key: 'join', width: 14 },
        { header: 'Trạng thái nộp', key: 'submit', width: 16 },
        { header: 'Thời điểm nộp', key: 'submitted_at', width: 20 },
        { header: 'Toạ độ GPS', key: 'gps', width: 22 },
        { header: 'Ghi chú', key: 'note', width: 34 },
      ],
      rows: exportRows,
    });
    showToast({ title: 'Đã xuất file Excel', description: `${exportRows.length} đoàn viên theo bộ lọc hiện tại.`, type: 'success' });
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-xs font-bold rounded-lg ${active ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`;

  return (
    <div className="space-y-3">
      {/* Thống kê nhanh */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Tổng đoàn viên', value: stats.total, cls: 'text-slate-800' },
          { label: 'Đã xác nhận tham gia', value: stats.joined, cls: 'text-emerald-700' },
          { label: 'Đã nộp minh chứng', value: stats.submitted, cls: 'text-[#1F5FBF]' },
          { label: 'Đã được duyệt', value: stats.approved, cls: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className="p-2.5 bg-white border border-slate-200 rounded-lg text-center">
            <p className={`text-lg font-extrabold ${s.cls}`}>{s.value}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bộ lọc */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên, chi đoàn, số điện thoại..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
            />
          </div>
          <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg">
            <option value="all">Tất cả chi đoàn</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button type="button" onClick={reload} className="p-2 text-slate-500 hover:text-slate-800 border border-slate-300 rounded-lg" title="Tải lại">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={handleExport} disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Xuất Excel ({filtered.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 mr-1">Nộp:</span>
          {([
            ['all', `Tất cả`], ['unsubmitted', 'Chưa nộp'], ['pending', 'Chờ duyệt'],
            ['approved', 'Đã duyệt'], ['rejected', 'Bị từ chối'],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSubmitFilter(k)} className={chip(submitFilter === k)}>{label}</button>
          ))}
          <span className="text-[11px] text-slate-400 ml-2 mr-1">Đăng ký:</span>
          {([
            ['all', 'Tất cả'], ['joined', 'Tham gia'], ['rejected', 'Từ chối'], ['none', 'Chưa xác nhận'],
          ] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setJoinFilter(k)} className={chip(joinFilter === k)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Danh sách */}
      {loading ? (
        <div className="p-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          Không có đoàn viên nào khớp bộ lọc.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden">
          {filtered.map(r => {
            const sub = submitLabel(r);
            const join = joinLabel(r);
            return (
              <button
                key={r.member.id}
                type="button"
                onClick={() => setDetail(r)}
                className="w-full p-3 flex items-center justify-between gap-3 hover:bg-slate-50 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={r.member.avatar_url || undefined} alt=""
                    className="w-8 h-8 rounded-full object-cover bg-slate-200 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{r.member.full_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {r.unit?.name ?? '—'}
                      {r.submission && ` • Nộp ${formatDateTimeVN(r.submission.submitted_at)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${join.cls}`}>{join.text}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${sub.cls}`}>{sub.text}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Chi tiết đoàn viên */}
      {detail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{detail.member.full_name}</h3>
                <p className="text-[11px] text-slate-500">{detail.unit?.name ?? '—'}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {!detail.submission ? (
                <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl">
                  <Clock className="w-6 h-6 mx-auto mb-1.5 text-slate-400" />
                  Đoàn viên này chưa nộp minh chứng.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${submitLabel(detail).cls}`}>
                      {submitLabel(detail).text}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Nộp: {formatDateTimeVN(detail.submission.submitted_at)}
                    </span>
                    {detail.submission.lat !== null && detail.submission.lng !== null ? (
                      <span className="text-[11px] text-emerald-700 inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {detail.submission.lat.toFixed(5)}, {detail.submission.lng.toFixed(5)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Không có GPS
                      </span>
                    )}
                  </div>

                  {detail.submission.note && (
                    <p className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 whitespace-pre-line">
                      {detail.submission.note}
                    </p>
                  )}
                  {detail.submission.review_note && (
                    <p className={`p-2 rounded-lg border ${
                      detail.submission.status === 'rejected'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                      <b>Ghi chú duyệt: </b>{detail.submission.review_note}
                    </p>
                  )}

                  {loadingEv ? (
                    <div className="p-6 text-center text-slate-400"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>
                  ) : evidences.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg">Bài nộp không kèm minh chứng.</p>
                  ) : (
                    <div className="space-y-3">
                      {evidences.filter(e => e.evidence_type === 'photo').length > 0 && (
                        <div>
                          <p className="font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                            <Camera className="w-3.5 h-3.5" /> Ảnh
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {evidences.filter(e => e.evidence_type === 'photo').map(ev => (
                              <button key={ev.id} type="button" onClick={() => setLightbox(ev)}
                                className="border border-slate-200 rounded-lg overflow-hidden group relative">
                                <img src={ev.url} alt={ev.file_name} className="w-full h-20 object-cover" />
                                <span className="absolute inset-0 hidden group-hover:flex items-center justify-center bg-slate-900/40 text-white">
                                  <Maximize2 className="w-4 h-4" />
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {evidences.filter(e => e.evidence_type === 'file').length > 0 && (
                        <div>
                          <p className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" /> Tệp
                          </p>
                          {evidences.filter(e => e.evidence_type === 'file').map(ev => (
                            <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer"
                              className="block text-[11px] text-[#1F5FBF] hover:underline truncate">
                              {ev.file_name || ev.storage_path}
                            </a>
                          ))}
                        </div>
                      )}
                      {evidences.filter(e => e.evidence_type === 'link').length > 0 && (
                        <div>
                          <p className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <Link2 className="w-3.5 h-3.5" /> Link
                          </p>
                          {evidences.filter(e => e.evidence_type === 'link').map(ev => (
                            <a key={ev.id} href={ev.url} target="_blank" rel="noreferrer"
                              className="block text-[11px] text-[#1F5FBF] hover:underline break-all">{ev.url}</a>
                          ))}
                        </div>
                      )}
                      {evidences.filter(e => e.evidence_type === 'list').length > 0 && (
                        <div>
                          <p className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                            <StickyNote className="w-3.5 h-3.5" /> Ghi chú minh chứng
                          </p>
                          {evidences.filter(e => e.evidence_type === 'list').map(ev => (
                            <p key={ev.id} className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2 whitespace-pre-line">
                              {ev.file_name}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/85 p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.file_name} className="w-full max-h-[75vh] object-contain rounded-xl bg-black" />
            <div className="flex items-center justify-between text-white text-xs mt-2">
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
