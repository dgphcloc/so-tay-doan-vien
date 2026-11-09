import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateVN } from '../../mock/data';
import type { DbTask, DbTaskResult } from '../../data/types';

interface Props {
  subCriterionId: string;
}

/**
 * Panel hiển thị các nhiệm vụ được tạo từ một tiêu chí con.
 * Giúp Bí thư xã thấy được minh chứng thực tế từ cơ sở trước khi tự chấm điểm.
 */
export const SubCriterionTasksPanel: React.FC<Props> = ({ subCriterionId }) => {
  const { listTasksBySubCriterion, getUnitById, showToast } = useApp();
  const [rows, setRows] = useState<Array<{ task: DbTask; results: DbTaskResult[]; unitName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listTasksBySubCriterion(subCriterionId);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          showToast({
            title: 'Không tải được nhiệm vụ',
            description: err instanceof Error ? err.message : '',
            type: 'error',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [subCriterionId, listTasksBySubCriterion, showToast]);

  const totalApproved = rows.reduce(
    (sum, r) => sum + r.results.filter(x => x.status === 'approved').length,
    0
  );

  return (
    <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200 space-y-3">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Thu gọn danh sách nhiệm vụ' : 'Mở rộng danh sách nhiệm vụ'}
        className="w-full flex items-center justify-between"
      >
        <div className="text-left">
          <span className="font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#1F5FBF]" />
            Nhiệm vụ phát sinh từ tiêu chí này
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
            ) : (
              <span className="text-[11px] font-bold text-white bg-[#1F5FBF] px-1.5 py-0.5 rounded-full">
                {rows.length}
              </span>
            )}
          </span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Minh chứng từ cơ sở giúp đối chiếu trước khi tự chấm điểm.
            {totalApproved > 0 && (
              <span className="font-semibold text-emerald-700"> {totalApproved} bài đã được duyệt.</span>
            )}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && !loading && (
        <>
          {rows.length === 0 ? (
            <div className="p-4 bg-white rounded-lg border border-slate-200 text-center text-[11px] text-slate-500">
              Chưa có chi đoàn nào tạo nhiệm vụ từ tiêu chí này.
              <div className="mt-2">
                <Link
                  to={`/nhiem-vu?fromCriterion=${subCriterionId}`}
                  title="Tạo nhiệm vụ mới gắn với tiêu chí này"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-[#1F5FBF] hover:bg-[#154690] rounded-lg"
                >
                  <Plus className="w-3 h-3" /> Tạo nhiệm vụ
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map(({ task, results }) => {
                const approved = results.filter(r => r.status === 'approved');
                const pending = results.filter(r => r.status === 'pending');
                return (
                  <div key={task.id} className="bg-white rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[11px] font-bold text-slate-800 line-clamp-2">{task.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-500">
                          <span>Hạn: {formatDateVN(task.due_date)}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">
                            {task.status === 'draft' ? 'Nháp' : task.status === 'closed' ? 'Đã đóng' : 'Đang chạy'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {approved.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5" /> {approved.length}
                          </span>
                        )}
                        {pending.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-2.5 h-2.5" /> {pending.length}
                          </span>
                        )}
                        {approved.length === 0 && pending.length === 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                            <AlertTriangle className="w-2.5 h-2.5" /> Chưa nộp
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Danh sách chi đoàn đã nộp */}
                    {results.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                        {results.map(r => (
                          <span
                            key={r.id}
                            title={`${getUnitById(r.unit_id)?.name ?? 'Chi đoàn'} — ${r.status === 'approved' ? 'Đã duyệt' : r.status === 'pending' ? 'Chờ duyệt' : 'Từ chối'}`}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              r.status === 'approved'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : r.status === 'pending'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {getUnitById(r.unit_id)?.name ?? 'Chi đoàn'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              <Link
                to={`/nhiem-vu?fromCriterion=${subCriterionId}`}
                title="Tạo thêm nhiệm vụ mới gắn với tiêu chí này"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-[#1F5FBF] bg-white border border-blue-300 hover:bg-blue-50 rounded-lg w-fit"
              >
                <Plus className="w-3 h-3" /> Tạo nhiệm vụ mới
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
};