import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { sha256HexOfString, pickImageFile } from '../utils/evidence';
import { formatDateVN } from '../mock/data';
import {
  BookOpen, Plus, Search, Loader2, X, ImagePlus, Camera, Link2, StickyNote,
  Trash2, Edit2, Download, Copy, Check, ExternalLink, Lock, Calendar,
} from 'lucide-react';

/**
 * Sổ tay cá nhân — nhật ký hoạt động RIÊNG TƯ TUYỆT ĐỐI.
 * Ngay cả bí thư xã/admin cũng không đọc được (RLS chỉ auth.uid() = profile_id).
 *
 * Mỗi mục: tên hoạt động, ngày (tự chọn, mặc định hôm nay), tối đa 10 ảnh,
 * nhiều link (mỗi link có ghi chú riêng), ghi chú chung.
 * Ảnh bấm xem lớn + nút tải; link có nút sao chép.
 */

interface DraftImage {
  url: string;
  storagePath: string;
  fileName: string;
}

interface DraftLink {
  url: string;
  note: string;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export const JournalPage: React.FC = () => {
  const {
    currentUser, journalEntries, refreshJournal, saveJournalEntry,
    deleteJournalEntry, uploadJournalImage, showToast,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form thêm/sửa
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [activityDate, setActivityDate] = useState(todayStr());
  const [note, setNote] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [links, setLinks] = useState<DraftLink[]>([]);
  const [busy, setBusy] = useState(false);

  // Xem ảnh lớn
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Đã sao chép link nào (hiện tick)
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  // Xóa
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => { await refreshJournal(); setLoading(false); })();
    /* eslint-disable-next-line */
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return journalEntries;
    const q = search.trim().toLowerCase();
    return journalEntries.filter(e =>
      [e.title, e.note].filter(Boolean).join(' ').toLowerCase().includes(q)
    );
  }, [journalEntries, search]);

  const openAdd = () => {
    setEditingId(null);
    setTitle('');
    setActivityDate(todayStr());
    setNote('');
    setImages([]);
    setLinks([]);
    setFormOpen(true);
  };

  const openEdit = (entryId: string) => {
    const e = journalEntries.find(x => x.id === entryId);
    if (!e) return;
    setEditingId(e.id);
    setTitle(e.title);
    setActivityDate(e.activity_date);
    setNote(e.note ?? '');
    setImages(e.images.map(i => ({ url: i.url, storagePath: i.storage_path, fileName: i.file_name ?? '' })));
    setLinks(e.links.map(l => ({ url: l.url, note: l.note ?? '' })));
    setFormOpen(true);
  };

  /** Thêm ảnh: tối đa 10. */
  const addImage = async () => {
    if (images.length >= 10) {
      showToast({ title: 'Tối đa 10 ảnh', description: 'Một hoạt động chỉ đính kèm tối đa 10 ảnh.', type: 'error' });
      return;
    }
    try {
      const file = await pickImageFile();
      if (!file) return;
      setBusy(true);
      const up = await uploadJournalImage(file);
      setImages(prev => [...prev, { url: up.url, storagePath: up.storagePath, fileName: file.name }]);
    } catch (e) {
      showToast({ title: 'Không thêm được ảnh', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  /** Tải ảnh về máy: bấm vào ảnh để xem, nút Tải để tải. */
  const handleDownloadImage = (url: string, fileName: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `anh-so-tay-${Date.now()}.jpg`;
    a.target = '_blank';
    a.click();
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(url);
      setTimeout(() => setCopiedLink(c => (c === url ? null : c)), 1500);
    } catch {
      showToast({ title: 'Không sao chép được', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast({ title: 'Vui lòng nhập tên hoạt động', type: 'error' });
      return;
    }
    if (!activityDate) {
      showToast({ title: 'Vui lòng chọn ngày', type: 'error' });
      return;
    }
    const validLinks = links.map(l => ({ url: l.url.trim(), note: l.note.trim() })).filter(l => l.url);
    for (const l of validLinks) {
      if (!/^https?:\/\//i.test(l.url)) {
        showToast({ title: 'Link không hợp lệ', description: `"${l.url}" phải bắt đầu bằng http(s)://`, type: 'error' });
        return;
      }
    }
    setBusy(true);
    try {
      const res = await saveJournalEntry({
        id: editingId ?? undefined,
        title: title.trim(),
        activity_date: activityDate,
        note: note.trim() || undefined,
        images: images.map(i => ({ storagePath: i.storagePath, url: i.url, fileName: i.fileName })),
        links: validLinks,
      });
      if (res.success) {
        showToast({ title: editingId ? 'Đã lưu thay đổi' : 'Đã thêm hoạt động', type: 'success' });
        setFormOpen(false);
      } else {
        showToast({ title: 'Không lưu được', description: res.message, type: 'error' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteJournalEntry(id);
    if (res.success) {
      showToast({ title: 'Đã xóa hoạt động', type: 'success' });
      setDeletingId(null);
    } else {
      showToast({ title: 'Không xóa được', description: res.message, type: 'error' });
    }
  };

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập để dùng sổ tay.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Tiêu đề */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-[#1F5FBF]" />
            Sổ tay của tôi
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Riêng tư — chỉ bạn xem được, kể cả cán bộ quản trị.
          </p>
        </div>
        <button type="button" onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg shrink-0">
          <Plus className="w-4 h-4" /> Thêm hoạt động
        </button>
      </div>

      {/* Tìm kiếm */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoạt động, ghi chú..."
          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
        />
      </div>

      {/* Form thêm/sửa — hiện dạng toàn trang */}
      {formOpen && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {editingId ? 'Sửa hoạt động' : 'Thêm hoạt động'}
            </h3>
            <button type="button" onClick={() => setFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="font-bold text-slate-800 block mb-1">Tên hoạt động (*):</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ví dụ: Ra quân vệ sinh tuyến đường ấp 1"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
            </div>
            <div>
              <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5" /> Ngày hoạt động:
              </label>
              <input type="date" value={activityDate} onChange={e => setActivityDate(e.target.value)}
                max={todayStr()}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]" />
            </div>
            <div>
              <label className="font-bold text-slate-800 block mb-1">Ảnh ({images.length}/10):</label>
              <button type="button" disabled={busy || images.length >= 10} onClick={addImage}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-white bg-[#1F5FBF] rounded-lg disabled:opacity-50">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                Thêm ảnh
              </button>
            </div>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <img src={img.url} alt={img.fileName} className="w-full h-20 object-cover" />
                  <button type="button" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 text-rose-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Link (nhiều link, mỗi link có ghi chú) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Link ({links.length})
              </label>
              <button type="button" onClick={() => setLinks(prev => [...prev, { url: '', note: '' }])}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg">
                + Thêm link
              </button>
            </div>
            {links.map((l, i) => (
              <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input value={l.url} onChange={e => setLinks(prev => prev.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                    placeholder="https://..."
                    className="flex-1 p-1.5 bg-white border border-slate-300 rounded text-[11px]" />
                  <button type="button" onClick={() => setLinks(prev => prev.filter((_, j) => j !== i))}
                    className="p-1 text-rose-600"><X className="w-3.5 h-3.5" /></button>
                </div>
                <input value={l.note} onChange={e => setLinks(prev => prev.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                  placeholder="Ghi chú của link này (ví dụ: Video tổng kết)"
                  className="w-full p-1.5 bg-white border border-slate-300 rounded text-[11px]" />
              </div>
            ))}
          </div>

          <div>
            <label className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <StickyNote className="w-3.5 h-3.5" /> Ghi chú:
            </label>
            <textarea rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Cảm nhận, kết quả, bài học rút ra..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg resize-none focus:outline-none focus:border-[#1F5FBF]" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={() => setFormOpen(false)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg">Huỷ</button>
            <button type="button" disabled={busy} onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-60">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? 'Lưu thay đổi' : 'Thêm hoạt động'}
            </button>
          </div>
        </div>
      )}

      {/* Danh sách */}
      {loading ? (
        <div className="p-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <Camera className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{search ? 'Không có hoạt động nào khớp tìm kiếm.' : 'Chưa có hoạt động nào. Bấm "Thêm hoạt động" để bắt đầu.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900">{e.title}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {formatDateVN(e.activity_date)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {deletingId === e.id ? (
                    <>
                      <button type="button" onClick={() => handleDelete(e.id)}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg">
                        Xóa luôn?
                      </button>
                      <button type="button" onClick={() => setDeletingId(null)}
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 rounded-lg">
                        Huỷ
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => openEdit(e.id)}
                        className="p-1.5 text-slate-400 hover:text-[#1F5FBF] hover:bg-blue-50 rounded-lg" title="Sửa">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setDeletingId(e.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Xóa">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {e.note && (
                <p className="text-xs text-slate-700 mt-2 whitespace-pre-line">{e.note}</p>
              )}

              {e.images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                  {e.images.map(img => (
                    <div key={img.id} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                      <button type="button" onClick={() => setLightbox(img.url)} className="block w-full">
                        <img src={img.url} alt={img.file_name ?? ''} className="w-full h-24 object-cover" loading="lazy" />
                      </button>
                      <button type="button" onClick={() => handleDownloadImage(img.url, img.file_name ?? '')}
                        title="Tải ảnh về máy"
                        className="absolute bottom-1 right-1 p-1.5 bg-white/95 rounded-lg text-slate-700 hover:text-[#1F5FBF] shadow">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {e.links.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {e.links.map(l => (
                    <div key={l.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <a href={l.url} target="_blank" rel="noreferrer"
                          className="text-[11px] text-[#1F5FBF] hover:underline break-all flex items-center gap-1">
                          {l.url.length > 60 ? `${l.url.slice(0, 60)}…` : l.url}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {l.note && <p className="text-[10px] text-slate-500 mt-0.5">{l.note}</p>}
                      </div>
                      <button type="button" onClick={() => handleCopyLink(l.url)}
                        title="Sao chép link"
                        className="p-1.5 text-slate-400 hover:text-[#1F5FBF] shrink-0">
                        {copiedLink === l.url ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Xem ảnh lớn */}
      {lightbox && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/85 p-4" onClick={() => setLightbox(null)}>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox} alt="" className="w-full max-h-[75vh] object-contain rounded-xl bg-black" />
            <div className="flex items-center justify-between mt-2 gap-2">
              <button type="button" onClick={() => handleDownloadImage(lightbox, `anh-so-tay-${Date.now()}.jpg`)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg">
                <Download className="w-3.5 h-3.5" /> Tải ảnh
              </button>
              <button type="button" onClick={() => setLightbox(null)}
                className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-white/80 hover:text-white">
                <X className="w-4 h-4" /> Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
