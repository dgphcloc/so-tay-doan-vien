import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, X, Loader2, QrCode } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface Props {
  taskId: string;
  taskTitle: string;
  onClose: () => void;
}

/** Link nộp cá nhân của một nhiệm vụ (app dùng HashRouter nên link nằm sau dấu #). */
export function buildMemberSubmitUrl(taskId: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/nop-ca-nhan?task=${encodeURIComponent(taskId)}`;
}

/** Hộp thoại hiện mã QR để đoàn viên quét và nộp minh chứng cá nhân. */
export const TaskQrModal: React.FC<Props> = ({ taskId, taskTitle, onClose }) => {
  const { showToast } = useApp();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url = buildMemberSubmitUrl(taskId);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 480, margin: 2, errorCorrectionLevel: 'M' })
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => showToast({ title: 'Không tạo được mã QR', type: 'error' }));
    return () => { cancelled = true; };
    /* eslint-disable-next-line */
  }, [url]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_nop_minh_chung_${taskId}.png`;
    a.click();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      showToast({ title: 'Đã sao chép link', type: 'success' });
    } catch {
      showToast({ title: 'Không sao chép được', description: 'Hãy chọn và sao chép link thủ công.', type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-[#1F5FBF]" /> QR nộp minh chứng cá nhân
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{taskTitle}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center bg-white border border-slate-200 rounded-xl p-2 min-h-[16rem]">
          {dataUrl
            ? <img src={dataUrl} alt="Mã QR nộp minh chứng" className="w-64 h-64" />
            : <Loader2 className="w-6 h-6 animate-spin text-slate-400" />}
        </div>

        <p className="text-[11px] text-slate-500">
          Đoàn viên quét mã, đăng nhập rồi nộp ảnh + GPS + ghi chú. Chỉ đoàn viên đúng phạm vi nhiệm vụ mới nộp được.
        </p>

        <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600 break-all select-all">{url}</div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={handleCopy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg">
            <Copy className="w-3.5 h-3.5" /> Sao chép link
          </button>
          <button type="button" disabled={!dataUrl} onClick={handleDownload}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-[#1F5FBF] hover:bg-[#1a4fa0] rounded-lg disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Tải ảnh QR
          </button>
        </div>
      </div>
    </div>
  );
};
