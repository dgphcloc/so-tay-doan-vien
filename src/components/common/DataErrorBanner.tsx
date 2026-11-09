import React, { useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { dataSource } from '../../data';
import { subscribeSnapshotError, getSnapshotError } from '../../data/snapshotError';

/**
 * Banner cảnh báo khi KHÔNG đọc được dữ liệu thật từ Supabase.
 *
 * Trước đây lỗi chỉ nằm trong console và app lặng lẽ hiển thị dữ liệu mẫu,
 * khiến người dùng tưởng nhầm số liệu thật. Banner này nói rõ: đang xem dữ
 * liệu mẫu, kèm nút tải lại.
 */
export const DataErrorBanner: React.FC = () => {
  const { refreshData, refreshError } = useApp();
  const snapshotError = useSyncExternalStore(subscribeSnapshotError, getSnapshotError, getSnapshotError);
  const [dismissed, setDismissed] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);

  const message = refreshError ?? snapshotError;

  // Chế độ mock thì không có gì phải báo
  if (dataSource === 'mock' || !message || dismissed) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await refreshData();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="bg-amber-50 border-b border-amber-300 px-4 py-2.5">
      <div className="flex items-start gap-2.5 max-w-7xl mx-auto">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-amber-900">
            Không tải được dữ liệu thật — đang hiển thị dữ liệu mẫu
          </p>
          <p className="text-[11px] text-amber-800 mt-0.5 break-words line-clamp-2">
            Số liệu bên dưới KHÔNG phải dữ liệu thật của đơn vị. {message}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={retrying}
          title="Thử tải lại dữ liệu thật từ máy chủ"
          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Đang tải…' : 'Thử lại'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          title="Ẩn cảnh báo này (dữ liệu vẫn là dữ liệu mẫu)"
          className="shrink-0 p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};