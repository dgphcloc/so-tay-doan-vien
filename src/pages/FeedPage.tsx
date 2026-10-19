import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDateVN } from '../mock/data';
import {
  Newspaper, Calendar, Users, CheckCircle2, XCircle, Loader2, RefreshCw, Clock, Target, Upload, BadgeCheck, AlertTriangle,
} from 'lucide-react';

export const FeedPage: React.FC = () => {
  const { currentUser, currentMember, currentRole, listMyFeed, setTaskRegistration, showToast } = useApp();
  const [feed, setFeed] = useState<Awaited<ReturnType<typeof listMyFeed>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unsubmitted' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');

  const isSecretary = currentRole === 'unit_secretary';
  const isMember = currentRole === 'member';

  const reload = async () => {
    setLoading(true);
    try {
      setFeed(await listMyFeed());
    } catch (e) {
      showToast({ title: 'Không tải được bảng tin', description: e instanceof Error ? e.message : '', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // Bộ lọc: trạng thái bài nộp + tìm theo tên nhiệm vụ
  const filteredFeed = useMemo(() => {
    if (!feed) return [];
    return feed.filter(({ task, mySubmission }) => {
      if (search.trim() && !task.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      const st = mySubmission?.status ?? 'unsubmitted';
      if (statusFilter === 'all') return true;
      return st === statusFilter;
    });
  }, [feed, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const c = { unsubmitted: 0, pending: 0, approved: 0, rejected: 0 };
    for (const f of feed ?? []) {
      const st = f.mySubmission?.status ?? 'unsubmitted';
      c[st] += 1;
    }
    return c;
  }, [feed]);

  const handleRegister = async (taskId: string, isJoining: boolean) => {
    setBusyId(taskId);
    const res = await setTaskRegistration(taskId, isJoining);
    setBusyId(null);
    if (res.success) {
      showToast({ title: isJoining ? 'Đã xác nhận tham gia' : 'Đã từ chối tham gia', type: 'success' });
      await reload();
    } else {
      showToast({ title: 'Không thực hiện được', description: res.message, type: 'error' });
    }
  };

  if (!currentUser) {
    return <div className="p-8 text-center text-slate-500">Vui lòng đăng nhập để xem bảng tin.</div>;
  }
  if (!currentMember?.unit_id) {
    return <div className="p-8 text-center text-slate-500">Tài khoản chưa gắn với chi đoàn nào.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Newspaper className="w-6 h-6 text-[#1F5FBF]" />
            Bảng tin nhiệm vụ
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {isSecretary
              ? 'Nhiệm vụ giao cho chi đoàn bạn — xem số đoàn viên đã xác nhận tham gia.'
              : 'Xác nhận tham gia hoặc từ chối các nhiệm vụ được giao cho chi đoàn bạn.'}
          </p>
        </div>
        <button type="button" onClick={reload} className="p-2 text-slate-500 hover:text-slate-800" title="Tải lại">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!loading && feed && feed.length > 0 && (
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'all', label: `Tất cả (${feed.length})` },
              { key: 'unsubmitted', label: `Chưa nộp (${statusCounts.unsubmitted})` },
              { key: 'pending', label: `Chờ duyệt (${statusCounts.pending})` },
              { key: 'approved', label: `Đã duyệt (${statusCounts.approved})` },
              { key: 'rejected', label: `Bị từ chối (${statusCounts.rejected})` },
            ] as const).map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                  statusFilter === f.key ? 'bg-[#1F5FBF] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên nhiệm vụ..."
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-[#1F5FBF]"
          />
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-slate-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : !feed || feed.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <Newspaper className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Chưa có nhiệm vụ nào được giao cho chi đoàn bạn.</p>
        </div>
      ) : filteredFeed.length === 0 ? (
        <div className="p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          <p className="text-sm">Không có nhiệm vụ nào khớp bộ lọc.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFeed.map(({ task, myRegistration, joinedCount, joinedNames, mySubmission }) => {
            const joined = myRegistration?.is_joining === true;
            const rejected = myRegistration && myRegistration.is_joining === false;
            const overdue = new Date(task.due_date) < new Date();

            return (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900">{task.title}</h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">{task.content}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Hạn: {formatDateVN(task.due_date)}
                        {overdue && <span className="text-rose-600 font-semibold">• Quá hạn</span>}
                      </span>
                      {task.target && <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {task.target}</span>}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {task.max_score}đ</span>
                    </div>

                    {/* Đoàn viên: trạng thái bài nộp cá nhân */}
                    {isMember && (
                      <div className="mt-2.5">
                        {!mySubmission ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                            <Upload className="w-3 h-3" /> Chưa nộp minh chứng
                          </span>
                        ) : mySubmission.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                            <BadgeCheck className="w-3 h-3" /> Đã được duyệt
                          </span>
                        ) : mySubmission.status === 'rejected' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                            <AlertTriangle className="w-3 h-3" /> Bị từ chối{mySubmission.review_note ? `: ${mySubmission.review_note}` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                            <Clock className="w-3 h-3" /> Chờ bí thư chi đoàn duyệt
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bí thư: xem số đã xác nhận */}
                    {isSecretary && (
                      <div className="mt-2.5 p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg">
                        <p className="text-[11px] font-bold text-[#1F5FBF] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" /> {joinedCount} đoàn viên đã xác nhận tham gia
                        </p>
                        {joinedNames.length > 0 && (
                          <p className="text-[11px] text-slate-600 mt-0.5">{joinedNames.join(', ')}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Đoàn viên: nút tham gia/từ chối */}
                  {!isSecretary && (
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => handleRegister(task.id, true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-60 ${
                          joined ? 'bg-emerald-600 text-white' : 'bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {busyId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {joined ? 'Đã tham gia' : 'Tham gia'}
                      </button>
                      <Link
                        to={`/nop-ca-nhan?task=${task.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#1F5FBF] text-white hover:bg-[#1a4fa0]"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {mySubmission ? 'Xem / nộp lại' : 'Nộp minh chứng'}
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === task.id}
                        onClick={() => handleRegister(task.id, false)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg disabled:opacity-60 ${
                          rejected ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {rejected ? 'Đã từ chối' : 'Từ chối'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
